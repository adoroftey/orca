import { z, type ZodType } from 'zod'
import type { ItsaplanRestApi } from '../../shared/itsaplan/types'
import {
  ItsaplanCommentOptionsSchema,
  ItsaplanCommentPageSchema,
  ItsaplanCommentSchema,
  ItsaplanId,
  ItsaplanIssueCreateSchema,
  ItsaplanIssueSchema,
  ItsaplanIssueSummarySchema,
  ItsaplanIssueUpdateSchema,
  ItsaplanProjectDetailsSchema,
  ItsaplanProjectRef,
  ItsaplanProjectSchema
} from '../../shared/itsaplan/schemas'
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

export function createItsaplanClient(options: {
  baseUrl: string
  apiKey: string
  fetch?: typeof fetch
}): ItsaplanRestApi {
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
      const parsed = schema.safeParse(await readJson(response))
      if (parsed.success) {
        return parsed.data
      }
    } catch {}
    throw new Error('Itsaplan returned an invalid or oversized response.')
  }
  const projectPath = (ref: string) =>
    `/projects/${encodeURIComponent(validated(ItsaplanProjectRef, ref))}`
  const issuePath = (id: number) => `/issues/${validated(ItsaplanId, id)}`
  return {
    listProjects: () => request('/projects', z.array(ItsaplanProjectSchema)),
    getProject: (ref) => request(projectPath(ref), ItsaplanProjectDetailsSchema),
    listIssues: async (ref) =>
      (
        await request(
          `${projectPath(ref)}/issues/board`,
          z.object({
            issues: z.array(ItsaplanIssueSchema)
          })
        )
      ).issues,
    searchIssues: (ref, query, limit = 500) => {
      const params = new URLSearchParams({
        q: validated(z.string().max(10_000), query),
        limit: String(validated(z.number().int().min(1).max(500), limit))
      })
      return request(
        `${projectPath(ref)}/issues/search?${params}`,
        z.array(ItsaplanIssueSummarySchema)
      )
    },
    getIssue: (id) => request(issuePath(id), ItsaplanIssueSchema),
    createIssue: (ref, input) =>
      request(
        `${projectPath(ref)}/issues`,
        ItsaplanIssueSchema,
        'POST',
        validated(ItsaplanIssueCreateSchema, input)
      ),
    updateIssue: (id, updates) =>
      request(
        issuePath(id),
        ItsaplanIssueSchema,
        'PATCH',
        validated(ItsaplanIssueUpdateSchema, updates)
      ),
    listComments: (id, options = {}) => {
      const page = validated(ItsaplanCommentOptionsSchema, options)
      const params = new URLSearchParams({
        filter: 'comments',
        order: 'asc',
        limit: String(page.limit ?? 100)
      })
      if (page.cursor) {
        params.set('cursor', JSON.stringify(page.cursor))
      }
      return request(`${issuePath(id)}/feed?${params}`, ItsaplanCommentPageSchema)
    },
    addComment: (id, body) =>
      request(`${issuePath(id)}/comments`, ItsaplanCommentSchema, 'POST', {
        body: validated(z.string().trim().min(1).max(50_000), body)
      })
  }
}
