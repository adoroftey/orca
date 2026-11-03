import { createServer, type Server } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, expect, it } from 'vitest'
import type { SecretStore } from '../../shared/secret-store'
import { createItsaplanConnection } from './connection'

let server: Server | undefined
let directory = ''
afterEach(() => {
  server?.closeAllConnections()
  server?.close()
  if (directory) {
    rmSync(directory, { recursive: true, force: true })
  }
})
it('connects through a local OAuth and MCP fixture and persists only encrypted credentials', async () => {
  let base = ''
  server = createServer(async (req, res) => {
    const send = (value: unknown, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(value))
    }
    if (req.url?.startsWith('/.well-known/oauth-protected-resource')) {
      return send({ resource: `${base}/mcp`, authorization_servers: [base] })
    }
    if (req.url?.startsWith('/.well-known/oauth-authorization-server')) {
      return send({
        issuer: base,
        authorization_endpoint: `${base}/authorize`,
        token_endpoint: `${base}/token`,
        registration_endpoint: `${base}/register`,
        response_types_supported: ['code'],
        token_endpoint_auth_methods_supported: ['none'],
        code_challenge_methods_supported: ['S256'],
        authorization_response_iss_parameter_supported: true
      })
    }
    if (req.url === '/register') {
      return send({ client_id: 'local-client', token_endpoint_auth_method: 'none' })
    }
    if (req.url === '/token') {
      return send({
        token_type: 'Bearer',
        access_token: 'local-access-token',
        refresh_token: 'local-refresh-token',
        expires_in: 3600
      })
    }
    if (req.url === '/docs/json') {
      return send({ paths: { '/projects': { get: { 'x-mcp': { tool: 'list_projects' } } } } })
    }
    if (req.url !== '/mcp' || req.headers.authorization !== 'Bearer local-access-token') {
      return send({}, 401)
    }
    if (req.method !== 'POST') {
      return send({}, 405)
    }
    let raw = ''
    for await (const chunk of req) {
      raw += chunk
    }
    const message = JSON.parse(raw)
    if (message.method === 'notifications/initialized') {
      res.writeHead(202)
      return res.end()
    }
    const result =
      message.method === 'initialize'
        ? {
            protocolVersion: '2025-03-26',
            capabilities: { tools: {} },
            serverInfo: { name: 'fixture', version: '1' }
          }
        : message.method === 'tools/list'
          ? {
              tools: [
                {
                  name: 'list_projects',
                  inputSchema: { type: 'object', properties: {}, additionalProperties: false }
                }
              ]
            }
          : {
              structuredContent: {
                ok: true,
                status: 200,
                data: [{ id: 1, key: 'P', ref: 'team.P', name: 'Project' }]
              },
              content: []
            }
    return send({ jsonrpc: '2.0', id: message.id, result })
  })
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The fixture server has completed listening on a TCP loopback address.
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  directory = mkdtempSync(join(tmpdir(), 'orca-oauth-e2e-'))
  const path = join(directory, 'connection.enc')
  const store: SecretStore = {
    isEncryptionAvailable: () => true,
    describeProtectionGap: () => null,
    encryptString: (text) => Buffer.from(`sealed:${Buffer.from(text).toString('base64')}`),
    decryptString: (bytes) => Buffer.from(bytes.toString().slice(7), 'base64').toString()
  }
  const connection = createItsaplanConnection({
    filePath: () => path,
    secretStore: () => store,
    openExternal: async (value) => {
      const auth = new URL(value)
      const callback = new URL(auth.searchParams.get('redirect_uri')!)
      callback.searchParams.set('state', auth.searchParams.get('state')!)
      callback.searchParams.set('code', 'local-code')
      callback.searchParams.set('iss', base)
      expect((await fetch(callback)).ok).toBe(true)
    }
  })
  expect(await connection.connect({ baseUrl: base, authMethod: 'oauth' })).toMatchObject({
    connected: true,
    authMethod: 'oauth'
  })
  expect(await connection.listProjects()).toMatchObject([{ key: 'P' }])
  expect(readFileSync(path, 'utf8')).not.toContain('local-access-token')
  expect(JSON.stringify(await connection.status())).not.toContain('local-refresh-token')
})
