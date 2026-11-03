import { connect } from 'node:net'
import { expect, it } from 'vitest'
import { authorizeItsaplanOAuth } from './oauth'

it('rejects a malformed absolute callback target without terminating the flow', async () => {
  const base = 'https://plan.example'
  let registration: Record<string, unknown> = {}
  const fetchMock: typeof fetch = async (input, init) => {
    const url = String(input)
    if (url.includes('oauth-protected-resource')) {
      return Response.json({ resource: `${base}/mcp`, authorization_servers: [base] })
    }
    if (url.includes('oauth-authorization-server')) {
      return Response.json({
        issuer: base,
        authorization_endpoint: `${base}/authorize`,
        token_endpoint: `${base}/token`,
        registration_endpoint: `${base}/register`,
        response_types_supported: ['code'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
        authorization_response_iss_parameter_supported: true
      })
    }
    if (url === `${base}/register`) {
      registration = JSON.parse(String(init?.body))
      return Response.json({ client_id: 'client', token_endpoint_auth_method: 'none' })
    }
    if (url === `${base}/token`) {
      return Response.json({ access_token: 'token', token_type: 'Bearer', expires_in: 3600 })
    }
    throw new Error('Unexpected fixture request')
  }
  let malformedResponse = ''
  const session = await authorizeItsaplanOAuth({
    baseUrl: base,
    fetch: fetchMock,
    openExternal: async (authorization) => {
      const auth = new URL(authorization)
      const redirect = new URL(auth.searchParams.get('redirect_uri')!)
      malformedResponse = await new Promise<string>((resolve, reject) => {
        const socket = connect(Number(redirect.port), '127.0.0.1')
        let response = ''
        socket.on('connect', () =>
          socket.write(
            `GET http://[::1 HTTP/1.1\r\nHost: ${redirect.host}\r\nConnection: close\r\n\r\n`
          )
        )
        socket.on('data', (chunk) => {
          response += chunk.toString()
        })
        socket.on('end', () => resolve(response))
        socket.on('error', reject)
      })
      redirect.searchParams.set('code', 'valid-code')
      redirect.searchParams.set('state', auth.searchParams.get('state')!)
      redirect.searchParams.set('iss', base)
      expect((await fetch(redirect)).status).toBe(200)
    }
  })
  expect(malformedResponse).toMatch(/^HTTP\/1\.1 400 /)
  expect(registration.application_type).toBe('native')
  expect(session.accessToken).toBe('token')
})
