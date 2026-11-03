import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { trustedBase, endpoint, json, tokenSession } from './oauth-support'

export type ItsaplanOAuthSession = {
  issuer: string
  resource: string
  clientId: string
  tokenEndpoint: string
  accessToken: string
  refreshToken?: string
  expiresAt: number
  scope?: string
}
export type OAuthMetadata = {
  issuer: string
  resource: string
  authorizationEndpoint: string
  tokenEndpoint: string
  registrationEndpoint: string
  responseIssRequired: boolean
  scope?: string
}

export async function discoverItsaplanOAuth(
  baseUrl: string,
  options: { fetch?: typeof fetch; signal?: AbortSignal } = {}
): Promise<OAuthMetadata> {
  const base = trustedBase(baseUrl)
  const root = base.href.replace(/\/$/, '')
  const fetcher = options.fetch ?? fetch
  const resourceDoc = await json(
    fetcher,
    `${base.origin}/.well-known/oauth-protected-resource${base.pathname.replace(/\/$/, '')}/mcp`,
    { signal: options.signal }
  )
  const resource = endpoint(resourceDoc.resource, base)
  if (resource !== `${root}/mcp`) {
    throw new Error('Untrusted Itsaplan OAuth resource.')
  }
  if (
    !Array.isArray(resourceDoc.authorization_servers) ||
    resourceDoc.authorization_servers.length !== 1 ||
    resourceDoc.authorization_servers[0] !== root
  ) {
    throw new Error('Untrusted Itsaplan OAuth issuer.')
  }
  const doc = await json(
    fetcher,
    `${base.origin}/.well-known/oauth-authorization-server${base.pathname.replace(/\/$/, '')}`,
    { signal: options.signal }
  )
  if (
    doc.issuer !== root ||
    !Array.isArray(doc.code_challenge_methods_supported) ||
    !doc.code_challenge_methods_supported.includes('S256') ||
    !Array.isArray(doc.response_types_supported) ||
    !doc.response_types_supported.includes('code') ||
    !Array.isArray(doc.token_endpoint_auth_methods_supported) ||
    !doc.token_endpoint_auth_methods_supported.includes('none')
  ) {
    throw new Error('Unsupported Itsaplan OAuth metadata.')
  }
  return {
    issuer: root,
    resource,
    authorizationEndpoint: endpoint(doc.authorization_endpoint, base),
    tokenEndpoint: endpoint(doc.token_endpoint, base),
    registrationEndpoint: endpoint(doc.registration_endpoint, base),
    responseIssRequired: doc.authorization_response_iss_parameter_supported === true,
    ...(Array.isArray(doc.scopes_supported) && doc.scopes_supported.includes('offline_access')
      ? {
          scope: [doc.scopes_supported.includes('openid') ? 'openid' : '', 'offline_access']
            .filter(Boolean)
            .join(' ')
        }
      : {})
  }
}
export async function authorizeItsaplanOAuth(options: {
  baseUrl: string
  fetch?: typeof fetch
  openExternal: (url: string) => Promise<void>
  signal?: AbortSignal
  now?: () => number
}): Promise<ItsaplanOAuthSession> {
  const abort = new AbortController()
  const onAbort = () => abort.abort()
  if (options.signal?.aborted) {
    throw new Error('Itsaplan sign-in cancelled.')
  }
  options.signal?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(onAbort, 300_000)
  const fetcher = options.fetch ?? fetch
  let server: ReturnType<typeof createServer> | undefined
  try {
    const metadata = await discoverItsaplanOAuth(options.baseUrl, {
      fetch: fetcher,
      signal: abort.signal
    })
    if (abort.signal.aborted) {
      throw new Error('Itsaplan sign-in cancelled.')
    }
    const state = randomBytes(32).toString('base64url')
    const verifier = randomBytes(32).toString('base64url')
    let resolveCallback!: (code: string) => void
    let rejectCallback!: (error: Error) => void
    const callback = new Promise<string>((resolve, reject) => {
      resolveCallback = resolve
      rejectCallback = reject
    })
    // Attach an abort listener before opening the browser, including while it is pending.
    // The listener may reject while registration or browser launch is still pending.
    void callback.catch(() => {})
    const callbackAbort = () =>
      rejectCallback(new Error('Itsaplan sign-in cancelled or timed out.'))
    abort.signal.addEventListener('abort', callbackAbort, { once: true })
    let callbackAccepted = false
    server = createServer((req, res) => {
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Referrer-Policy', 'no-referrer')
      const bad = () => {
        res.writeHead(400)
        res.end('Invalid sign-in response.')
      }
      if (
        callbackAccepted ||
        req.method !== 'GET' ||
        !req.url ||
        req.url.length > 8192 ||
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The server listens on a TCP loopback address before accepting requests.
        req.headers.host !== `127.0.0.1:${(server!.address() as { port: number }).port}`
      ) {
        return bad()
      }
      let url: URL
      try {
        url = new URL(req.url, 'http://127.0.0.1')
      } catch {
        return bad()
      }
      if (
        url.pathname !== '/callback' ||
        [...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length !== 1) ||
        url.searchParams.get('state') !== state ||
        (metadata.responseIssRequired && url.searchParams.get('iss') !== metadata.issuer) ||
        (url.searchParams.has('iss') && url.searchParams.get('iss') !== metadata.issuer) ||
        url.searchParams.has('code') === url.searchParams.has('error')
      ) {
        return bad()
      }
      callbackAccepted = true
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('You may close this window.')
      if (url.searchParams.has('error')) {
        rejectCallback(new Error('Itsaplan sign-in was denied.'))
      } else {
        resolveCallback(url.searchParams.get('code')!)
      }
    })
    await new Promise<void>((resolve, reject) => {
      server!.once('error', reject)
      server!.listen(0, '127.0.0.1', resolve)
    })
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The server has completed listening on a TCP loopback address.
    const redirectUri = `http://127.0.0.1:${(server.address() as { port: number }).port}/callback`
    const registration = await json(fetcher, metadata.registrationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Orca (Itsplan integration)',
        application_type: 'native',
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code']
      }),
      signal: abort.signal
    })
    if (
      typeof registration.client_id !== 'string' ||
      !registration.client_id ||
      (registration.token_endpoint_auth_method !== undefined &&
        registration.token_endpoint_auth_method !== 'none') ||
      registration.client_secret !== undefined
    ) {
      throw new Error('Invalid Itsaplan OAuth client registration.')
    }
    if (abort.signal.aborted) {
      throw new Error('Itsaplan sign-in cancelled.')
    }
    const auth = new URL(metadata.authorizationEndpoint)
    if (metadata.scope) {
      auth.searchParams.set('scope', metadata.scope)
    }
    for (const [key, value] of Object.entries({
      response_type: 'code',
      client_id: registration.client_id,
      redirect_uri: redirectUri,
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      resource: metadata.resource
    })) {
      auth.searchParams.set(key, value)
    }
    const launch = Promise.resolve()
      .then(() => options.openExternal(auth.href))
      .catch(() => {
        throw new Error('Unable to open the browser for Itsaplan sign-in.')
      })
    await Promise.race([
      launch,
      new Promise<never>((_, reject) => {
        if (abort.signal.aborted) {
          reject(new Error('Itsaplan sign-in cancelled or timed out.'))
        } else {
          abort.signal.addEventListener(
            'abort',
            () => reject(new Error('Itsaplan sign-in cancelled or timed out.')),
            { once: true }
          )
        }
      })
    ])
    const code = await callback
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: registration.client_id,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      resource: metadata.resource
    })
    const doc = await json(fetcher, metadata.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: abort.signal
    })
    if (abort.signal.aborted) {
      throw new Error('Itsaplan sign-in cancelled.')
    }
    return tokenSession(
      doc,
      {
        issuer: metadata.issuer,
        resource: metadata.resource,
        clientId: registration.client_id,
        tokenEndpoint: metadata.tokenEndpoint
      },
      (options.now ?? Date.now)()
    )
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
    server?.closeAllConnections()
    server?.close()
  }
}
export async function refreshItsaplanOAuth(
  session: ItsaplanOAuthSession,
  options: { fetch?: typeof fetch; now?: () => number } = {}
): Promise<ItsaplanOAuthSession> {
  const base = trustedBase(session.issuer)
  if (
    endpoint(session.tokenEndpoint, base) !== session.tokenEndpoint ||
    endpoint(session.resource, base) !== session.resource ||
    session.resource !== `${session.issuer.replace(/\/$/, '')}/mcp` ||
    !session.refreshToken
  ) {
    throw new Error('Itsaplan sign-in must be renewed.')
  }
  const doc = await json(options.fetch ?? fetch, session.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: session.clientId,
      refresh_token: session.refreshToken,
      resource: session.resource
    })
  })
  return tokenSession(doc, session, (options.now ?? Date.now)())
}
