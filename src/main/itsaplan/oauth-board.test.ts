import { expect, it, vi } from 'vitest'
import { createItsaplanOAuthTransport } from './oauth-transport'

const base = 'https://plan.example'
const session = {
  issuer: base,
  resource: `${base}/mcp`,
  tokenEndpoint: `${base}/token`,
  clientId: 'client',
  accessToken: 'token',
  expiresAt: 2_000_000_000_000
}
function fixture(count: number, paged = false) {
  const calls: { name: string; arguments: Record<string, unknown> }[] = []
  let active = 0
  let peak = 0
  let release!: () => void
  const parallelReads = new Promise<void>((resolve) => {
    release = resolve
  })
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    if (String(input).endsWith('/docs/json')) {
      return Response.json({
        paths: {
          '/projects/{projectKey}/issues': { get: { 'x-mcp': { tool: 'list_issues' } } },
          '/issues/{issueId}': { get: { 'x-mcp': { tool: 'get_issue' } } }
        }
      })
    }
    const rpc = JSON.parse(String(init?.body))
    if (rpc.method === 'notifications/initialized') {
      return new Response(null, { status: 202 })
    }
    let result: unknown
    if (rpc.method === 'initialize') {
      result = {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'fixture', version: '1' }
      }
    } else if (rpc.method === 'tools/list') {
      result = {
        tools: [
          {
            name: 'list_issues',
            inputSchema: {
              type: 'object',
              properties: {
                projectKey: { type: 'string' },
                limit: { type: 'integer' },
                createdFrom: { type: 'string' },
                createdTo: { type: 'string' }
              },
              required: ['projectKey'],
              additionalProperties: false
            }
          },
          {
            name: 'get_issue',
            inputSchema: {
              type: 'object',
              properties: { issueId: { type: 'integer' } },
              required: ['issueId'],
              additionalProperties: false
            }
          }
        ]
      }
    } else {
      calls.push(rpc.params)
      if (rpc.params.name === 'list_issues') {
        result = {
          structuredContent: {
            ok: true,
            status: 200,
            data: Array.from({ length: count }, (_, index) => ({
              id: index + 1,
              ...(paged
                ? {
                    createdAt: new Date(
                      Date.parse('2024-01-01T00:00:00.000Z') + index * 1000
                    ).toISOString()
                  }
                : {})
            }))
              .filter(
                (row) =>
                  !paged ||
                  (typeof row.createdAt === 'string' &&
                    (!rpc.params.arguments.createdFrom ||
                      row.createdAt >= rpc.params.arguments.createdFrom) &&
                    (!rpc.params.arguments.createdTo ||
                      row.createdAt < rpc.params.arguments.createdTo))
              )
              .slice(0, 500)
          },
          content: []
        }
      } else {
        active++
        peak = Math.max(peak, active)
        if (active === Math.min(count, 8)) {
          release()
        }
        await parallelReads
        active--
        const id = rpc.params.arguments.issueId
        const links =
          id === 1
            ? [
                { id: 99, kind: 'blocks', direction: 'inward', issue: { id: 2, archived: false } },
                {
                  id: 100,
                  kind: 'relates',
                  direction: 'outward',
                  issue: { id: 999, archived: true }
                }
              ]
            : []
        result = {
          structuredContent: {
            ok: true,
            status: 200,
            data: {
              id,
              archivedAt: null,
              description: 'real detail',
              links,
              subtasks: [{ id: 3 }, { id: 4 }]
            }
          },
          content: []
        }
      }
    }
    return Response.json({ jsonrpc: '2.0', id: rpc.id, result })
  })
  return {
    transport: createItsaplanOAuthTransport({
      baseUrl: base,
      getCredential: async () => session,
      fetch: fetchMock
    }),
    calls,
    fetchMock,
    peak: () => peak
  }
}
it('hydrates the active board with a single MCP session and bounded parallel reads', async () => {
  const f = fixture(10)
  const result = await f.transport('/projects/TEAM/issues/board')
  expect(result.status).toBe(200)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The fixture constructs this board response with the asserted shape.
  const data = result.data as {
    issues: { description: string; subtaskCount: number; links: unknown[] }[]
  }
  expect(data.issues).toHaveLength(10)
  expect(data.issues[0]).toMatchObject({
    description: 'real detail',
    subtaskCount: 2,
    links: [{ id: 99, issueId: 2, relation: 'blocked_by' }]
  })
  expect(f.calls[0]).toMatchObject({
    name: 'list_issues',
    arguments: { projectKey: 'TEAM', limit: 500 }
  })
  expect(f.calls).toHaveLength(11)
  expect(f.peak()).toBeLessThanOrEqual(8)
  expect(f.peak()).toBeGreaterThan(1)
  const initialization = vi
    .mocked(f.fetchMock)
    .mock.calls.filter(([, init]) => String(init?.body).includes('"method":"initialize"'))
  expect(initialization).toHaveLength(1)
})
it('fails explicitly when a full page lacks creation dates before hydration', async () => {
  const f = fixture(500)
  await expect(f.transport('/projects/TEAM/issues/board')).rejects.toThrow(
    'complete board is unavailable'
  )
  expect(f.calls).toHaveLength(1)
})

it('sends creation bounds through MCP schema validation for a large board', async () => {
  const f = fixture(501, true)
  const result = await f.transport('/projects/TEAM/issues/board')
  expect(result.status).toBe(200)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The fixture constructs this board response with hydrated issues.
  const data = result.data as { issues: { id: number; description: string }[] }
  expect(data.issues).toHaveLength(501)
  expect(new Set(data.issues.map((issue) => issue.id)).size).toBe(501)
  expect(data.issues.every((issue) => issue.description === 'real detail')).toBe(true)
  const lists = f.calls.filter((call) => call.name === 'list_issues')
  expect(lists.some((call) => typeof call.arguments.createdFrom === 'string')).toBe(true)
  expect(lists.some((call) => typeof call.arguments.createdTo === 'string')).toBe(true)
})
