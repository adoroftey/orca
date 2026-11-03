import type { Client } from '@modelcontextprotocol/sdk/client/index.js'

type Tool = Awaited<ReturnType<Client['listTools']>>['tools'][number]
export type Shared = { client?: Client; tools?: Tool[] }
// Responses cross the MCP boundary and are checked before use.
// eslint-disable-next-line typescript/no-explicit-any
type Obj = Record<string, any>
function object(value: unknown): value is Obj {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
type Execute = (
  path: string,
  method?: string,
  body?: unknown,
  retry?: boolean,
  shared?: Shared
) => Promise<{ status: number; data: unknown }>
export async function loadOAuthBoard(
  projectKey: string,
  execute: Execute
): Promise<{ status: number; data: unknown }> {
  const context: Shared = {}
  try {
    const listing = await execute(
      `/projects/${projectKey}/issues?limit=500`,
      'GET',
      undefined,
      false,
      context
    )
    if (listing.status === 403) {
      throw new Error('Itsaplan MCP access denied (HTTP 403). Check MCP and project permissions.')
    }
    if (listing.status !== 200 || !Array.isArray(listing.data)) {
      throw new Error('Unable to load Itsaplan board.')
    }
    if (listing.data.length >= 500) {
      throw new Error(
        'This server OAuth issue list is limited to 500; a complete board is unavailable.'
      )
    }
    const summaries = listing.data
    const ids = new Set<number>()
    for (const summary of summaries) {
      if (
        !object(summary) ||
        !Number.isSafeInteger(summary.id) ||
        summary.id < 1 ||
        ids.has(summary.id)
      ) {
        throw new Error('Invalid Itsaplan board response.')
      }
      ids.add(summary.id)
    }
    const issues: unknown[] = Array.from({ length: summaries.length })
    let index = 0
    await Promise.all(
      Array.from({ length: Math.min(8, issues.length) }, async () => {
        while (index < issues.length) {
          const position = index++
          const summary = summaries[position]
          if (!object(summary) || !Number.isSafeInteger(summary.id) || summary.id < 1) {
            throw new Error('Invalid Itsaplan board response.')
          }
          const detail = await execute(`/issues/${summary.id}`, 'GET', undefined, false, context)
          if (detail.status === 403) {
            throw new Error(
              'Itsaplan MCP access denied (HTTP 403). Check MCP and project permissions.'
            )
          }
          if (detail.status !== 200 || !object(detail.data)) {
            throw new Error('Unable to load Itsaplan board issue.')
          }
          if (
            detail.data.id !== summary.id ||
            detail.data.archivedAt !== null ||
            !Array.isArray(detail.data.links) ||
            !Array.isArray(detail.data.subtasks)
          ) {
            throw new Error('Itsaplan board changed while loading. Refresh and try again.')
          }
          issues[position] = detail.data
        }
      })
    )
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Issue details are validated as objects before insertion.
    const activeIds = new Set(issues.map((issue) => (issue as Obj).id))
    const inverse: Record<string, string> = {
      blocks: 'blocked_by',
      blocked_by: 'blocks',
      relates: 'relates',
      duplicates: 'duplicated_by',
      duplicated_by: 'duplicates'
    }
    const boardIssues = issues.map((value) => {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Issue details are validated as objects before insertion.
      const issue = value as Obj
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Each detail links field is checked as an array before insertion.
      const links = (issue.links as unknown[]).flatMap((link) => {
        if (
          !object(link) ||
          !object(link.issue) ||
          !Number.isSafeInteger(link.id) ||
          !Number.isSafeInteger(link.issue.id) ||
          typeof link.kind !== 'string' ||
          !inverse[link.kind] ||
          !['outward', 'inward'].includes(link.direction)
        ) {
          throw new Error('Invalid Itsaplan issue relation.')
        }
        if (!activeIds.has(link.issue.id)) {
          return []
        }
        return [
          {
            id: link.id,
            issueId: link.issue.id,
            relation: link.direction === 'outward' ? link.kind : inverse[link.kind]
          }
        ]
      })
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Each detail subtasks field is checked as an array before insertion.
      return { ...issue, links, subtaskCount: (issue.subtasks as unknown[]).length }
    })
    return { status: 200, data: { issues: boardIssues } }
  } finally {
    await context.client?.close().catch(() => {})
  }
}
