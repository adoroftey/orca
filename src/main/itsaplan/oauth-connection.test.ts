import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, expect, it, vi } from 'vitest'
import type { SecretStore } from '../../shared/secret-store'

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), refresh: vi.fn(), transport: vi.fn() }))
vi.mock('./oauth', () => ({
  authorizeItsaplanOAuth: mocks.authorize,
  refreshItsaplanOAuth: mocks.refresh
}))
vi.mock('./oauth-transport', () => ({ createItsaplanOAuthTransport: mocks.transport }))
import { createItsaplanConnection } from './connection'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
  vi.resetAllMocks()
})
const session = {
  issuer: 'https://new.example',
  resource: 'https://new.example/mcp',
  tokenEndpoint: 'https://new.example/token',
  clientId: 'client',
  accessToken: 'secret-access',
  refreshToken: 'secret-refresh',
  expiresAt: Date.now() + 100000
}
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'orca-oauth-'))
  directories.push(directory)
  const path = join(directory, 'connection.enc')
  const store: SecretStore = {
    isEncryptionAvailable: () => true,
    describeProtectionGap: () => null,
    encryptString: (text) => Buffer.from(`sealed:${Buffer.from(text).toString('base64')}`),
    decryptString: (bytes) => Buffer.from(bytes.toString().slice(7), 'base64').toString()
  }
  const connection = createItsaplanConnection({
    filePath: () => path,
    fetch: vi.fn<typeof fetch>(async () => Response.json([])),
    secretStore: () => store,
    openExternal: async () => {}
  })
  mocks.transport.mockReturnValue(async () => ({ status: 200, data: [] }))
  return { connection, path }
}
it('saves OAuth only after verification, returns no secrets, and reads old API key records', async () => {
  const { connection, path } = fixture()
  await connection.connect({ baseUrl: 'https://old.example', apiKey: 'old-key' })
  mocks.authorize.mockResolvedValue(session)
  const status = await connection.connect({ baseUrl: 'https://new.example', authMethod: 'oauth' })
  expect(status).toMatchObject({ connected: true, authMethod: 'oauth' })
  expect(JSON.stringify(status)).not.toContain('secret-access')
  expect(readFileSync(path, 'utf8')).not.toContain('secret-access')
  expect(await connection.status()).toEqual(status)
})
it('preserves old credentials when sign-in is cancelled while pending', async () => {
  const { connection, path } = fixture()
  await connection.connect({ baseUrl: 'https://old.example', apiKey: 'old-key' })
  const before = readFileSync(path)
  let resolve!: (value: typeof session) => void
  mocks.authorize.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r
      })
  )
  const pending = connection.connect({ baseUrl: 'https://new.example', authMethod: 'oauth' })
  await connection.cancelConnect?.()
  resolve(session)
  await expect(pending).rejects.toThrow()
  expect(readFileSync(path)).toEqual(before)
  expect((await connection.status()).baseUrl).toBe('https://old.example')
})

it('serializes token refresh and saves the rotated token once', async () => {
  const { connection, path } = fixture()
  mocks.authorize.mockResolvedValue({ ...session, expiresAt: 0 })
  await connection.connect({ baseUrl: 'https://new.example', authMethod: 'oauth' })
  let resolve!: (value: typeof session) => void
  mocks.refresh.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  mocks.transport.mockImplementation(({ getCredential }) => async () => {
    await getCredential()
    return { status: 200, data: [] }
  })
  const first = connection.listProjects()
  const second = connection.listProjects()
  await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce())
  resolve({ ...session, accessToken: 'rotated-access', refreshToken: 'rotated-refresh' })
  await Promise.all([first, second])
  expect(mocks.refresh).toHaveBeenCalledOnce()
  const sealed = readFileSync(path, 'utf8')
  const stored = JSON.parse(Buffer.from(sealed.slice(7), 'base64').toString())
  expect(stored.auth.session).toMatchObject({
    accessToken: 'rotated-access',
    refreshToken: 'rotated-refresh'
  })
})

it('cannot restore refreshed credentials after disconnect', async () => {
  const { connection } = fixture()
  mocks.authorize.mockResolvedValue({ ...session, expiresAt: 0 })
  await connection.connect({ baseUrl: 'https://new.example', authMethod: 'oauth' })
  let resolve!: (value: typeof session) => void
  mocks.refresh.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  mocks.transport.mockImplementation(({ getCredential }) => async () => {
    await getCredential()
    return { status: 200, data: [] }
  })
  const pending = connection.listProjects()
  await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce())
  await connection.disconnect()
  resolve({ ...session, accessToken: 'late-token' })
  await expect(pending).rejects.toThrow()
  expect(await connection.status()).toMatchObject({ connected: false })
})
