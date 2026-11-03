import { normalizeItsaplanServerUrl } from './server-url'
import type { ItsaplanOAuthSession } from './oauth'

export function trustedBase(value: string): URL {
  const url = new URL(normalizeItsaplanServerUrl(value))
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
  ) {
    throw new Error('Itsaplan OAuth requires HTTPS or a loopback address.')
  }
  return url
}
export function endpoint(value: unknown, base: URL): string {
  if (typeof value !== 'string') {
    throw new Error('Invalid Itsaplan OAuth metadata.')
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Invalid Itsaplan OAuth endpoint.')
  }
  if (url.origin !== base.origin || url.username || url.password || url.hash || url.search) {
    throw new Error('Untrusted Itsaplan OAuth endpoint.')
  }
  return url.href.replace(/\/$/, '')
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export async function json(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit = {}
): Promise<Record<string, unknown>> {
  try {
    const response = await fetcher(url, {
      ...init,
      redirect: 'error',
      signal: init.signal ?? AbortSignal.timeout(30_000)
    })
    if (
      !response.ok ||
      response.redirected ||
      Number(response.headers.get('content-length')) > 1024 * 1024
    ) {
      throw new Error('Itsaplan OAuth request failed.')
    }
    if (!response.body) {
      throw new Error('Invalid Itsaplan OAuth response.')
    }
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const part = await reader.read()
        if (part.done) {
          break
        }
        size += part.value.byteLength
        if (size > 1024 * 1024) {
          await reader.cancel()
          throw new Error('Itsaplan OAuth response is too large.')
        }
        chunks.push(part.value)
      }
    } finally {
      reader.releaseLock()
    }
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!isRecord(data)) {
      throw new Error('Invalid Itsaplan OAuth response.')
    }
    return data
  } catch {
    throw new Error('Itsaplan OAuth request failed or returned an invalid response.')
  }
}

export function tokenSession(
  doc: Record<string, unknown>,
  original: Omit<ItsaplanOAuthSession, 'accessToken' | 'expiresAt'>,
  now: number
): ItsaplanOAuthSession {
  if (
    typeof doc.access_token !== 'string' ||
    !doc.access_token ||
    /[\r\n]/.test(doc.access_token) ||
    typeof doc.token_type !== 'string' ||
    doc.token_type.toLowerCase() !== 'bearer' ||
    typeof doc.expires_in !== 'number' ||
    !Number.isFinite(doc.expires_in) ||
    doc.expires_in <= 0 ||
    doc.expires_in > 31536000 ||
    (doc.refresh_token !== undefined &&
      (typeof doc.refresh_token !== 'string' || !doc.refresh_token)) ||
    (doc.scope !== undefined && typeof doc.scope !== 'string')
  ) {
    throw new Error('Invalid Itsaplan OAuth token response.')
  }
  return {
    ...original,
    accessToken: doc.access_token,
    expiresAt: now + doc.expires_in * 1000,
    ...(typeof doc.refresh_token === 'string' ? { refreshToken: doc.refresh_token } : {}),
    ...(typeof doc.scope === 'string' ? { scope: doc.scope } : {})
  }
}
