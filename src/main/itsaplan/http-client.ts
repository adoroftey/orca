import type { ZodType } from 'zod'
import { normalizeItsaplanServerUrl } from './server-url'
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024

async function readJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
    throw new Error('Itsaplan response is too large.')
  }
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Itsaplan returned an empty response.')
  }
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) {
        break
      }
      size += next.value.byteLength
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel()
        throw new Error('Itsaplan response is too large.')
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder().decode(bytes))
}

function validated<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw new Error('Invalid Itsaplan request parameters.')
  }
  return parsed.data
}

export function createItsaplanHttpClient(options: {
  baseUrl: string
  apiKey: string
  fetch?: typeof fetch
}) {
  const baseUrl = normalizeItsaplanServerUrl(options.baseUrl)
  const apiKey = options.apiKey.trim()
  if (!apiKey || /[\r\n]/.test(apiKey)) {
    throw new Error('Enter a valid Itsaplan API key.')
  }
  const fetchRequest = options.fetch ?? globalThis.fetch
  const request = async <T>(
    path: string,
    schema: ZodType<T>,
    method = 'GET',
    body?: unknown
  ): Promise<T> => {
    let response: Response
    try {
      response = await fetchRequest(`${baseUrl}${path}`, {
        method,
        headers: {
          'x-api-key': apiKey,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      })
    } catch {
      throw new Error('Unable to reach Itsaplan. Check the server address and connection.')
    }
    if (!response.ok || response.redirected) {
      await response.body?.cancel().catch(() => {})
      throw new Error(
        response.status === 401 || response.status === 403
          ? 'Itsaplan denied access. Check your API key and project permissions.'
          : `Itsaplan request failed (HTTP ${response.status}).`
      )
    }
    try {
      const parsed = schema.safeParse(
        response.status === 204 ? undefined : await readJson(response)
      )
      if (parsed.success) {
        return parsed.data
      }
    } catch {}
    throw new Error('Itsaplan returned an invalid or oversized response.')
  }
  return { request, validated }
}
