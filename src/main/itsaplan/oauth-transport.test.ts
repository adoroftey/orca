import { describe, expect, it, vi } from 'vitest'
import { createItsaplanOAuthTransport } from './oauth-transport'

const base = 'https://plan.example'
const session = {
  issuer: base,
  resource: `${base}/mcp`,
  clientId: 'client',
  tokenEndpoint: `${base}/token`,
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: 9999999999999
}
const schema = {
  type: 'object',
  properties: {
    projectKey: { type: 'string' },
    title: { type: 'string' },
    filter: { type: 'string' }
  },
  additionalProperties: false
}
const docs = {
  openapi: '3.0.0',
  info: { title: 'fixture', version: '1' },
  paths: {
    '/projects': { get: { 'x-mcp': { tool: 'list_projects' }, parameters: [] } },
    '/projects/{projectKey}/issues': {
      get: {
        'x-mcp': { tool: 'list_issues' },
        parameters: [
          { in: 'path', name: 'projectKey', required: true, schema: { type: 'string' } },
          { in: 'query', name: 'filter', schema: { type: 'string' } }
        ]
      },
      post: {
        'x-mcp': { tool: 'create_issue' },
        parameters: [
          { in: 'path', name: 'projectKey', required: true, schema: { type: 'string' } }
        ],
        requestBody: { content: { 'application/json': { schema } } }
      }
    },
    '/danger': { post: { 'x-mcp': { tool: 'delete_everything' } } }
  }
}

type Rpc = {
  jsonrpc: string
  id?: number | string
  method: string
  params?: { name?: string; arguments?: Record<string, unknown> }
}
function fixture(
  options: { firstCallStatus?: number; callResult?: unknown; failCall?: boolean } = {}
) {
  const calls: Rpc[] = []
  const requests: { url: string; init?: RequestInit }[] = []
  const getCredential = vi.fn(async (forceRefresh?: boolean) => ({
    ...session,
    accessToken: forceRefresh ? 'new-access' : 'access'
  }))
  let toolCalls = 0
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    requests.push({ url, init })
    if (url === `${base}/docs/json`) {
      return Response.json(docs)
    }
    if (url !== `${base}/mcp`) {
      throw new Error(`unexpected URL ${url}`)
    }
    const message: Rpc = JSON.parse(String(init?.body))
    calls.push(message)
    if (message.method === 'notifications/initialized') {
      return new Response(null, { status: 202 })
    }
    let result: unknown
    if (message.method === 'initialize') {
      result = {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'fixture', version: '1' }
      }
    } else if (message.method === 'tools/list') {
      result = {
        tools: ['list_projects', 'list_issues', 'create_issue', 'delete_everything'].map(
          (name) => ({ name, inputSchema: schema })
        )
      }
    } else if (message.method === 'tools/call') {
      toolCalls++
      if (options.failCall) {
        throw new Error('timeout')
      }
      if (options.firstCallStatus && toolCalls === 1) {
        return new Response(null, { status: options.firstCallStatus })
      }
      result = options.callResult ?? {
        structuredContent: {
          ok: true,
          status: message.params?.name === 'create_issue' ? 201 : 200,
          data: message.params?.name === 'create_issue' ? { id: 42 } : [{ id: 7 }]
        },
        content: []
      }
    } else {
      throw new Error(`unexpected method ${message.method}`)
    }
    return Response.json({ jsonrpc: '2.0', id: message.id, result })
  })
  const transport = createItsaplanOAuthTransport({ baseUrl: base, getCredential, fetch: fetchMock })
  return { transport, calls, requests, getCredential }
}

describe('Itsaplan OAuth MCP transport', () => {
  it('maps REST reads and writes onto listed MCP tools with pinned bearer and arguments', async () => {
    const { transport, calls, requests } = fixture()
    await expect(transport('/projects')).resolves.toEqual({ status: 200, data: [{ id: 7 }] })
    await expect(transport('/projects/TEAM/issues', 'POST', { title: 'A task' })).resolves.toEqual({
      status: 201,
      data: { id: 42 }
    })
    const toolCalls = calls.filter((c) => c.method === 'tools/call')
    expect(toolCalls.map((c) => c.params?.name)).toEqual(['list_projects', 'create_issue'])
    expect(toolCalls[1].params?.arguments).toMatchObject({ projectKey: 'TEAM', title: 'A task' })
    expect(
      requests
        .filter((r) => r.url === `${base}/mcp`)
        .every(
          (r) =>
            new Headers(r.init?.headers).get('authorization') === 'Bearer access' &&
            r.init?.redirect === 'error'
        )
    ).toBe(true)
    expect(
      new Headers(requests.find((r) => r.url.endsWith('/docs/json'))?.init?.headers).get(
        'authorization'
      )
    ).toBeNull()
  })

  it('keeps JSON query filters as strings', async () => {
    const { transport, calls } = fixture()
    const filter = JSON.stringify({ status: ['open'] })
    await transport(`/projects/TEAM/issues?filter=${encodeURIComponent(filter)}`)
    expect(calls.find((c) => c.method === 'tools/call')?.params?.arguments).toMatchObject({
      projectKey: 'TEAM',
      filter
    })
  })

  it('interprets structured empty and error results', async () => {
    const empty = fixture({
      callResult: { structuredContent: { ok: true, status: 204, data: null }, content: [] }
    })
    await expect(empty.transport('/projects')).resolves.toEqual({ status: 204, data: null })
    const failure = fixture({
      callResult: {
        structuredContent: { ok: false, status: 403, error: 'MCP disabled' },
        content: [],
        isError: true
      }
    })
    const outcome = await failure.transport('/projects').catch((error: unknown) => error)
    expect(JSON.stringify(outcome)).toContain('403')
  })

  it('refreshes and retries a safe GET once after 401', async () => {
    const { transport, getCredential, calls } = fixture({ firstCallStatus: 401 })
    await expect(transport('/projects')).resolves.toEqual({ status: 200, data: [{ id: 7 }] })
    expect(getCredential).toHaveBeenCalledWith(true)
    expect(calls.filter((c) => c.method === 'tools/call')).toHaveLength(2)
  })

  it.each(['unauthorized', 'timeout'])('never replays a mutation after %s', async (failure) => {
    const { transport, calls, getCredential } = fixture(
      failure === 'timeout' ? { failCall: true } : { firstCallStatus: 401 }
    )
    await expect(transport('/projects/TEAM/issues', 'POST', { title: 'A task' })).rejects.toThrow()
    expect(calls.filter((c) => c.method === 'tools/call')).toHaveLength(1)
    expect(getCredential).not.toHaveBeenCalledWith(true)
  })

  it.each([
    ['https://evil.example/projects', 'GET', undefined],
    ['/projects/../danger', 'POST', {}],
    ['/projects/TEAM%2Fother/issues', 'POST', { title: 'A' }],
    ['/projects/TEAM/issues', 'POST', { projectKey: 'OTHER', title: 'A' }],
    ['/danger', 'POST', {}]
  ] as const)('refuses unsafe or unsupported route %s', async (path, method, body) => {
    const { transport, calls } = fixture()
    await expect(transport(path, method, body)).rejects.toThrow()
    expect(calls.filter((c) => c.method === 'tools/call')).toHaveLength(0)
  })
})
