import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { authorizeItsaplanOAuth, discoverItsaplanOAuth, refreshItsaplanOAuth } from './oauth'

const base = 'https://plan.example'
const metadata = {
  issuer: base,
  authorization_endpoint: `${base}/authorize`,
  token_endpoint: `${base}/token`,
  registration_endpoint: `${base}/register`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  token_endpoint_auth_methods_supported: ['none'],
  code_challenge_methods_supported: ['S256'],
  authorization_response_iss_parameter_supported: true
}
const resource = { resource: `${base}/mcp`, authorization_servers: [base] }
const json = (value: unknown) => Response.json(value)

function oauthFetch(overrides: { metadata?: unknown; resource?: unknown } = {}) {
  const requests: { url: string; init?: RequestInit }[] = []
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    requests.push({ url, init })
    if (url.includes('oauth-protected-resource')) {
      return json(overrides.resource ?? resource)
    }
    if (url.includes('oauth-authorization-server')) {
      return json(overrides.metadata ?? metadata)
    }
    if (url === `${base}/register`) {
      return json({ client_id: 'client-1', token_endpoint_auth_method: 'none' })
    }
    if (url === `${base}/token`) {
      return json({
        access_token: 'access-1',
        refresh_token: 'refresh-2',
        token_type: 'Bearer',
        expires_in: 3600
      })
    }
    throw new Error(`unexpected request: ${url}`)
  })
  return { fetchMock, requests }
}

function form(init?: RequestInit) {
  return new URLSearchParams(String(init?.body))
}
function callback(authUrl: string, changes: (url: URL) => void = () => {}) {
  const auth = new URL(authUrl)
  const url = new URL(auth.searchParams.get('redirect_uri')!)
  url.searchParams.set('code', 'fixture-code')
  url.searchParams.set('state', auth.searchParams.get('state')!)
  url.searchParams.set('iss', base)
  changes(url)
  return fetch(url)
}

describe('Itsaplan OAuth security contract', () => {
  it('discovers pinned metadata without allowing redirects', async () => {
    const { fetchMock, requests } = oauthFetch()
    await expect(discoverItsaplanOAuth(base, { fetch: fetchMock })).resolves.toMatchObject({
      issuer: base,
      resource: `${base}/mcp`,
      authorizationEndpoint: `${base}/authorize`,
      tokenEndpoint: `${base}/token`,
      registrationEndpoint: `${base}/register`,
      responseIssRequired: true
    })
    expect(requests.length).toBeGreaterThan(0)
    expect(requests.every(({ init }) => init?.redirect === 'error')).toBe(true)
  })

  it.each([
    { metadata: { ...metadata, issuer: 'https://evil.example' } },
    { metadata: { ...metadata, token_endpoint: 'https://evil.example/token' } },
    {
      metadata: { ...metadata, authorization_endpoint: 'https://user:pass@plan.example/authorize' }
    },
    { resource: { ...resource, resource: 'https://evil.example/mcp' } }
  ])('rejects untrusted discovery %j', async (override) => {
    const { fetchMock } = oauthFetch(override)
    await expect(discoverItsaplanOAuth(base, { fetch: fetchMock })).rejects.toThrow()
  })

  it('rejects non-loopback cleartext before network access', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    await expect(
      discoverItsaplanOAuth('http://plan.example', { fetch: fetchMock })
    ).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('registers a public client and binds PKCE, state, issuer and redirect to the code exchange', async () => {
    const { fetchMock, requests } = oauthFetch()
    let authorization = ''
    const session = await authorizeItsaplanOAuth({
      baseUrl: base,
      fetch: fetchMock,
      now: () => 1000,
      openExternal: async (url) => {
        authorization = url
        await callback(url)
      }
    })
    const auth = new URL(authorization)
    expect(auth.origin + auth.pathname).toBe(`${base}/authorize`)
    expect(auth.searchParams.get('code_challenge_method')).toBe('S256')
    expect(auth.searchParams.get('state')).toBeTruthy()
    const redirect = new URL(auth.searchParams.get('redirect_uri')!)
    expect(redirect.hostname).toBe('127.0.0.1')
    const registration = JSON.parse(
      String(requests.find((r) => r.url === `${base}/register`)!.init?.body)
    )
    expect(registration.redirect_uris).toEqual([redirect.href])
    expect(registration.token_endpoint_auth_method).toBe('none')
    const exchange = requests.find((r) => r.url === `${base}/token`)!
    const token = form(exchange.init)
    expect(token.get('code')).toBe('fixture-code')
    expect(token.get('redirect_uri')).toBe(redirect.href)
    expect(token.get('resource')).toBe(`${base}/mcp`)
    expect(createHash('sha256').update(token.get('code_verifier')!).digest('base64url')).toBe(
      auth.searchParams.get('code_challenge')
    )
    expect(exchange.init?.redirect).toBe('error')
    expect(session).toMatchObject({
      issuer: base,
      resource: `${base}/mcp`,
      clientId: 'client-1',
      tokenEndpoint: `${base}/token`,
      accessToken: 'access-1',
      refreshToken: 'refresh-2',
      expiresAt: 3601000
    })
  })

  it('refuses wrong state, missing issuer and duplicate parameters without terminating the legitimate flow', async () => {
    const { fetchMock } = oauthFetch()
    const statuses: number[] = []
    const session = await authorizeItsaplanOAuth({
      baseUrl: base,
      fetch: fetchMock,
      openExternal: async (url) => {
        statuses.push((await callback(url, (u) => u.searchParams.set('state', 'wrong'))).status)
        statuses.push((await callback(url, (u) => u.searchParams.delete('iss'))).status)
        statuses.push((await callback(url, (u) => u.searchParams.append('code', 'second'))).status)
        statuses.push((await callback(url)).status)
      }
    })
    expect(statuses.slice(0, 3).every((status) => status >= 400)).toBe(true)
    expect(statuses[3]).toBeLessThan(400)
    expect(session.accessToken).toBe('access-1')
  })

  it('aborts and closes the callback listener', async () => {
    const { fetchMock } = oauthFetch()
    const controller = new AbortController()
    let redirect = ''
    await expect(
      authorizeItsaplanOAuth({
        baseUrl: base,
        fetch: fetchMock,
        signal: controller.signal,
        openExternal: async (url) => {
          redirect = new URL(url).searchParams.get('redirect_uri')!
          controller.abort()
        }
      })
    ).rejects.toThrow()
    await expect(fetch(redirect)).rejects.toThrow()
  })

  it('rotates refresh tokens while preserving pinned identity and endpoint', async () => {
    const { fetchMock, requests } = oauthFetch()
    const original = {
      issuer: base,
      resource: `${base}/mcp`,
      clientId: 'client-1',
      tokenEndpoint: `${base}/token`,
      accessToken: 'old',
      refreshToken: 'refresh-1',
      expiresAt: 0
    }
    const refreshed = await refreshItsaplanOAuth(original, { fetch: fetchMock, now: () => 1000 })
    expect(refreshed).toMatchObject({
      ...original,
      accessToken: 'access-1',
      refreshToken: 'refresh-2',
      expiresAt: 3601000
    })
    const request = requests.find((r) => r.url === `${base}/token`)!
    expect(form(request.init).get('refresh_token')).toBe('refresh-1')
    expect(request.init?.redirect).toBe('error')
  })
})
