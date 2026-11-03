import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SecretStore } from '../../shared/secret-store'
import { createItsaplanConnection } from './connection'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'orca-itsaplan-'))
  directories.push(directory)
  const path = join(directory, 'connection.enc')
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => Response.json([]))
  const store: SecretStore = {
    isEncryptionAvailable: () => true,
    describeProtectionGap: () => null,
    encryptString: (text) => Buffer.from(`sealed:${Buffer.from(text).toString('base64')}`),
    decryptString: (bytes) => Buffer.from(bytes.toString().slice(7), 'base64').toString()
  }
  const connection = createItsaplanConnection({
    filePath: () => path,
    fetch: fetchMock,
    secretStore: () => store
  })
  return { connection, fetchMock, store, path }
}

describe('Itsaplan connection persistence', () => {
  it('verifies before encrypted save and exposes only public connection status', async () => {
    const { connection, path } = fixture()
    const result = await connection.connect({
      baseUrl: 'https://api.plan.example/',
      webBaseUrl: 'https://plan.example/',
      apiKey: 'test-private-key'
    })
    expect(result).toEqual({
      connected: true,
      baseUrl: 'https://api.plan.example',
      webBaseUrl: 'https://plan.example'
    })
    expect(readFileSync(path, 'utf8')).not.toContain('test-private-key')
    expect(JSON.stringify(await connection.status())).not.toContain('test-private-key')
  })

  it('keeps a working connection when replacement credentials fail validation', async () => {
    const { connection, path, fetchMock } = fixture()
    await connection.connect({ baseUrl: 'https://old.example', apiKey: 'old-key' })
    const before = readFileSync(path)
    fetchMock.mockImplementationOnce(async () =>
      Response.json({ error: 'bad-key' }, { status: 401 })
    )
    await expect(
      connection.connect({ baseUrl: 'https://new.example', apiKey: 'bad-key' })
    ).rejects.toThrow('denied access')
    expect(readFileSync(path)).toEqual(before)
    expect((await connection.status()).baseUrl).toBe('https://old.example')
  })

  it('refuses saving when the OS cannot protect the secret, preserving existing bytes', async () => {
    const { connection, store, path } = fixture()
    await connection.connect({ baseUrl: 'https://old.example', apiKey: 'old-key' })
    const before = readFileSync(path)
    store.isEncryptionAvailable = () => false
    await expect(
      connection.connect({ baseUrl: 'https://new.example', apiKey: 'new-key' })
    ).rejects.toThrow('secure credential storage')
    expect(readFileSync(path)).toEqual(before)
  })

  it('refuses a weak encryption backend rather than disguising plaintext as encryption', async () => {
    const { connection, store } = fixture()
    store.describeProtectionGap = () => 'basic_text'
    await expect(
      connection.connect({ baseUrl: 'http://localhost:3000', apiKey: 'key' })
    ).rejects.toThrow('secure credential storage')
  })

  it('removes the connection on disconnect and rejects later task requests', async () => {
    const { connection } = fixture()
    await connection.connect({ baseUrl: 'https://old.example', apiKey: 'old-key' })
    await connection.disconnect()
    expect(await connection.status()).toEqual({ connected: false, baseUrl: null, webBaseUrl: null })
    await expect(connection.listProjects()).rejects.toThrow('Connect Itsaplan')
  })

  it('does not restore an in-flight connection after disconnect', async () => {
    const { connection, fetchMock } = fixture()
    let resolve: (response: Response) => void = () => {}
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((settle) => {
          resolve = settle
        })
    )
    const pending = connection.connect({ baseUrl: 'https://old.example', apiKey: 'old-key' })
    await connection.disconnect()
    resolve(Response.json([]))
    await expect(pending).rejects.toThrow('changed')
    expect((await connection.status()).connected).toBe(false)
  })

  it('refuses a mutation from the old server scope after another client reconnects', async () => {
    const { connection, fetchMock } = fixture()
    await connection.connect({ baseUrl: 'https://old.example', apiKey: 'old-key' })
    const oldServer = connection.forServer('https://old.example')
    await connection.connect({ baseUrl: 'https://new.example', apiKey: 'new-key' })
    fetchMock.mockClear()
    await expect(
      oldServer.updateIssue(42, { title: 'Must not reach the new server' })
    ).rejects.toThrow('server changed')
    expect(fetchMock).not.toHaveBeenCalled()
    await expect(connection.disconnect('https://old.example')).rejects.toThrow('server changed')
    expect((await connection.status()).baseUrl).toBe('https://new.example')
  })

  it('does not publish credentials into a profile selected while verification is in flight', async () => {
    const { fetchMock, store, path } = fixture()
    let currentPath = path
    const connection = createItsaplanConnection({
      filePath: () => currentPath,
      fetch: fetchMock,
      secretStore: () => store
    })
    let resolve: (response: Response) => void = () => {}
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((settle) => {
          resolve = settle
        })
    )
    const pending = connection.connect({ baseUrl: 'https://old.example', apiKey: 'private-key' })
    currentPath = `${path}.another-profile`
    resolve(Response.json([]))
    await expect(pending).rejects.toThrow('changed')
    expect((await connection.status()).connected).toBe(false)
    currentPath = path
    expect((await connection.status()).connected).toBe(false)
  })
})
