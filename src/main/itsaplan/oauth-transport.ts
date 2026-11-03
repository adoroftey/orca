import Ajv from 'ajv'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { ItsaplanOAuthSession } from './oauth'
import { trustedBase } from './oauth-support'
import { loadOAuthBoard, type Shared } from './oauth-board'
import { allowed, object, loadTools, type Obj } from './oauth-mcp-mapping'

export function createItsaplanOAuthTransport(options: {
  baseUrl: string
  getCredential: (forceRefresh?: boolean) => Promise<ItsaplanOAuthSession>
  fetch?: typeof fetch
  signal?: AbortSignal
}) {
  const base = trustedBase(options.baseUrl).href.replace(/\/$/, '')
  const fetcher = options.fetch ?? fetch
  const ajv = new Ajv({ strict: false })
  const boundedFetch: typeof fetch = async (input, init) => {
    const url = String(input)
    if (url !== `${base}/mcp` && url !== `${base}/docs/json`) {
      throw new Error('Untrusted Itsaplan request.')
    }
    const response = await fetcher(input, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.any([
        ...(init?.signal ? [init.signal] : []),
        ...(options.signal ? [options.signal] : []),
        AbortSignal.timeout(30_000)
      ])
    })
    if (response.redirected || Number(response.headers.get('content-length')) > 32 * 1024 * 1024) {
      throw new Error('Invalid Itsaplan response.')
    }
    if (!response.body) {
      return response
    }
    let size = 0
    const stream = response.body.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          size += chunk.byteLength
          if (size > 32 * 1024 * 1024) {
            throw new Error('Itsaplan response is too large.')
          }
          controller.enqueue(chunk)
        }
      })
    )
    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })
  }
  let docsPromise: Promise<Obj> | undefined
  async function docs() {
    return (docsPromise ??= (async () => {
      const r = await boundedFetch(`${base}/docs/json`, { headers: { Accept: 'application/json' } })
      if (!r.ok) {
        throw new Error('Unable to load Itsaplan capabilities.')
      }
      const d: unknown = await r.json()
      if (!object(d) || !object(d.paths)) {
        throw new Error('Invalid Itsaplan capabilities.')
      }
      return d
    })())
  }
  async function execute(
    path: string,
    method = 'GET',
    body?: unknown,
    retry = false,
    shared?: Shared
  ): Promise<{ status: number; data: unknown }> {
    const pathPart = path.split('?', 1)[0]
    if (
      !path.startsWith('/') ||
      path.startsWith('//') ||
      /%(?:2f|5c|2e|25)/i.test(pathPart) ||
      pathPart.includes('\\') ||
      /(?:^|\/)\.\.?($|\/)/.test(pathPart)
    ) {
      throw new Error('Invalid Itsaplan path.')
    }
    const url = new URL(path, 'https://local.invalid')
    if (url.origin !== 'https://local.invalid' || url.hash) {
      throw new Error('Invalid Itsaplan path.')
    }
    const board =
      method === 'GET' && !url.search && /^\/projects\/([^/]+)\/issues\/board$/.exec(url.pathname)
    if (board) {
      return loadOAuthBoard(board[1], execute)
    }
    const document = await docs()
    const credential = await options.getCredential(retry)
    if (
      credential.issuer !== base ||
      credential.resource !== `${base}/mcp` ||
      /[\r\n]/.test(credential.accessToken)
    ) {
      throw new Error('Invalid Itsaplan credential.')
    }
    let client = shared?.client
    let tools = shared?.tools
    const isShared = Boolean(shared)
    try {
      if (!client || !tools) {
        const transport = new StreamableHTTPClientTransport(new URL(credential.resource), {
          fetch: boundedFetch,
          requestInit: {
            headers: { Authorization: `Bearer ${credential.accessToken}` },
            redirect: 'error'
          },
          reconnectionOptions: {
            maxRetries: 0,
            maxReconnectionDelay: 0,
            initialReconnectionDelay: 0,
            reconnectionDelayGrowFactor: 1
          }
        })
        client = new Client({ name: 'orca-itsaplan', version: '1.0.0' })
        if (shared) {
          shared.client = client
        }
        await client.connect(transport)
        tools = await loadTools(client)
        if (shared) {
          shared.tools = tools
        }
      }
      const confirmedTools = tools
      if (!confirmedTools || !client) {
        throw new Error('Invalid Itsaplan MCP session.')
      }
      const operations = allowed.filter(
        ([verb, template, name]) =>
          verb === method &&
          object(document.paths[template]) &&
          object(document.paths[template][verb.toLowerCase()]) &&
          document.paths[template][verb.toLowerCase()]['x-mcp']?.tool === name &&
          confirmedTools.some((tool) => tool.name === name)
      )
      if (url.pathname === '/docs/json' && method === 'GET') {
        const paths: Obj = {}
        for (const [verb, template, name] of allowed) {
          if (
            object(document.paths[template]) &&
            document.paths[template][verb.toLowerCase()]?.['x-mcp']?.tool === name &&
            confirmedTools.some((tool) => tool.name === name)
          ) {
            ;(paths[template] ??= {})[verb.toLowerCase()] =
              document.paths[template][verb.toLowerCase()]
          }
        }
        return { status: 200, data: { ...document, paths } }
      }
      const target =
        url.pathname === '/account/preferences' && method === 'GET' ? '/me' : url.pathname
      const matches = operations.flatMap(([, template, name]) => {
        const names: string[] = []
        const pattern = template
          .split('/')
          .map((part) => {
            const match = /^\{([^}]+)\}$/.exec(part)
            if (match) {
              names.push(match[1])
              return '([^/]+)'
            }
            return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          })
          .join('/')
        const match = new RegExp(`^${pattern}$`).exec(target)
        return match
          ? [
              {
                template,
                name,
                params: Object.fromEntries(
                  names.map((n, i) => [n, decodeURIComponent(match[i + 1])])
                )
              }
            ]
          : []
      })
      if (matches.length !== 1) {
        throw new Error('Itsaplan operation is unsupported or ambiguous.')
      }
      const match = matches[0]
      const tool = confirmedTools.find((t) => t.name === match.name)!
      const args: Obj = {}
      const putParameter = (key: string, raw: string) => {
        if (key in args) {
          throw new Error('Duplicate Itsaplan parameter.')
        }
        const property = object(tool.inputSchema.properties)
          ? tool.inputSchema.properties[key]
          : undefined
        args[key] =
          object(property) && (property.type === 'number' || property.type === 'integer')
            ? Number(raw)
            : object(property) && property.type === 'boolean'
              ? raw === 'true'
                ? true
                : raw === 'false'
                  ? false
                  : raw
              : raw
      }
      for (const [key, value] of Object.entries(match.params)) {
        putParameter(key, value)
      }
      for (const [key, raw] of url.searchParams) {
        putParameter(key, raw)
      }
      if (body !== undefined) {
        if (!object(body)) {
          throw new Error('Invalid Itsaplan body.')
        }
        for (const [key, value] of Object.entries(body)) {
          if (key in args) {
            throw new Error('Duplicate Itsaplan parameter.')
          }
          args[key] = value
        }
      }
      if (!ajv.validate(tool.inputSchema, args)) {
        throw new Error('Invalid Itsaplan parameters.')
      }
      const result = await client.callTool({ name: match.name, arguments: args })
      let structured: unknown = result.structuredContent
      if (
        !structured &&
        Array.isArray(result.content) &&
        result.content.length === 1 &&
        object(result.content[0]) &&
        result.content[0].type === 'text' &&
        typeof result.content[0].text === 'string'
      ) {
        structured = JSON.parse(result.content[0].text)
      }
      if (
        !object(structured) ||
        typeof structured.status !== 'number' ||
        typeof structured.ok !== 'boolean'
      ) {
        throw new Error('Invalid Itsaplan MCP result.')
      }
      if (target === '/me' && url.pathname === '/account/preferences') {
        const user =
          object(structured.data) && object(structured.data.user) ? structured.data.user : undefined
        if (!user || typeof user.timezone !== 'string') {
          throw new Error('Itsaplan timezone unavailable.')
        }
        return { status: structured.status, data: { timezone: user.timezone } }
      }
      return { status: structured.status, data: structured.ok ? structured.data : structured.error }
    } catch (error) {
      if (
        method === 'GET' &&
        !retry &&
        error instanceof Error &&
        (('code' in error && error.code === 401) || error.name === 'UnauthorizedError')
      ) {
        return execute(path, method, body, true)
      }
      if (error instanceof Error && 'code' in error && error.code === 403) {
        throw new Error('Itsaplan MCP access denied (HTTP 403). Check MCP and project permissions.')
      }
      if (
        error instanceof Error &&
        [
          'Itsaplan operation is unsupported or ambiguous.',
          'Duplicate Itsaplan parameter.',
          'Invalid Itsaplan parameters.',
          'Invalid Itsaplan body.',
          'Itsaplan timezone unavailable.'
        ].includes(error.message)
      ) {
        throw error
      }
      throw new Error('Itsaplan MCP request failed.')
    } finally {
      if (!isShared) {
        await client?.close().catch(() => {})
      }
    }
  }
  return execute
}
