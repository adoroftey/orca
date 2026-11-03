import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { getSecretStore, type SecretStore } from '../../shared/secret-store'
import type {
  ItsaplanApi,
  ItsaplanConnectionStatus,
  ItsaplanRestApi
} from '../../shared/itsaplan/types'
import { ItsaplanConnectSchema } from '../../shared/itsaplan/schemas'
import { writeCredentialFileAtomic } from '../credentials/integration-credential-file'
import { createItsaplanClient } from './client'
import { normalizeItsaplanServerUrl } from './server-url'
import { readProfileIndex } from '../orca-profiles/profile-index-store'
import {
  getOrcaProfileDirectory,
  getOrcaProfileIndexPath
} from '../orca-profiles/profile-storage-paths'

export function getItsaplanConnectionFile(): string {
  const index = readProfileIndex(getOrcaProfileIndexPath())
  if (!index) {
    throw new Error('Unable to resolve the active Orca profile for Itsaplan.')
  }
  return join(getOrcaProfileDirectory(index.activeProfileId), 'itsaplan-connection.enc')
}

type ItsaplanConnection = Omit<ItsaplanApi, 'disconnect'> & {
  forServer(baseUrl: string): ItsaplanRestApi
  disconnect(expectedBaseUrl?: string): Promise<void>
}

const StoredConnection = z
  .object({
    baseUrl: z.string(),
    webBaseUrl: z.string(),
    apiKey: z.string().min(1)
  })
  .strict()

export function createItsaplanConnection(
  options: {
    filePath?: () => string
    fetch?: typeof fetch
    secretStore?: () => SecretStore
  } = {}
): ItsaplanConnection {
  const filePath = options.filePath ?? getItsaplanConnectionFile
  const secretStore = options.secretStore ?? getSecretStore
  let generation = 0
  const read = () => {
    let bytes: Buffer
    try {
      bytes = readFileSync(filePath())
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return null
      }
      throw new Error('Unable to read the saved Itsaplan connection.')
    }
    try {
      const store = secretStore()
      if (!store.isEncryptionAvailable()) {
        throw new Error('Unavailable keyring')
      }
      const record = StoredConnection.parse(JSON.parse(store.decryptString(bytes)))
      return {
        ...record,
        baseUrl: normalizeItsaplanServerUrl(record.baseUrl),
        webBaseUrl: normalizeItsaplanServerUrl(record.webBaseUrl)
      }
    } catch {
      throw new Error(
        'Could not decrypt the saved Itsaplan connection. Unlock your keyring or reconnect Itsaplan.'
      )
    }
  }
  const status = (): ItsaplanConnectionStatus => {
    const record = read()
    return record
      ? { connected: true, baseUrl: record.baseUrl, webBaseUrl: record.webBaseUrl }
      : { connected: false, baseUrl: null, webBaseUrl: null }
  }
  const client = (expectedBaseUrl?: string) => {
    const record = read()
    if (!record) {
      throw new Error('Connect Itsaplan before working with tasks.')
    }
    if (expectedBaseUrl !== undefined && record.baseUrl !== expectedBaseUrl) {
      throw new Error('The Itsaplan server changed. Refresh Tasks before continuing.')
    }
    return createItsaplanClient({ ...record, fetch: options.fetch })
  }
  const restApi = (expectedBaseUrl?: string): ItsaplanRestApi => ({
    listProjects: async () => client(expectedBaseUrl).listProjects(),
    getProject: async (ref) => client(expectedBaseUrl).getProject(ref),
    listIssues: async (ref) => client(expectedBaseUrl).listIssues(ref),
    searchIssues: async (ref, query, limit) =>
      client(expectedBaseUrl).searchIssues(ref, query, limit),
    getIssue: async (id) => client(expectedBaseUrl).getIssue(id),
    createIssue: async (ref, input) => client(expectedBaseUrl).createIssue(ref, input),
    updateIssue: async (id, updates) => client(expectedBaseUrl).updateIssue(id, updates),
    listComments: async (id, page) => client(expectedBaseUrl).listComments(id, page),
    addComment: async (id, body) => client(expectedBaseUrl).addComment(id, body)
  })
  return {
    ...restApi(),
    forServer: (baseUrl) => restApi(normalizeItsaplanServerUrl(baseUrl)),
    status: async () => status(),
    connect: async (args) => {
      const parsed = ItsaplanConnectSchema.safeParse(args)
      if (!parsed.success) {
        throw new Error('Enter a valid Itsaplan server address and API key.')
      }
      const version = ++generation
      const destination = filePath()
      const record = {
        baseUrl: normalizeItsaplanServerUrl(parsed.data.baseUrl),
        webBaseUrl: normalizeItsaplanServerUrl(
          parsed.data.webBaseUrl?.trim() || parsed.data.baseUrl
        ),
        apiKey: parsed.data.apiKey
      }
      await createItsaplanClient({ ...record, fetch: options.fetch }).listProjects()
      if (version !== generation || destination !== filePath()) {
        throw new Error('The Itsaplan connection changed while connecting. Try again.')
      }
      const store = secretStore()
      if (!store.isEncryptionAvailable() || store.describeProtectionGap() !== null) {
        throw new Error(
          'Itsaplan requires secure credential storage. Unlock or configure your OS keyring first.'
        )
      }
      try {
        const encrypted = store.encryptString(JSON.stringify(record))
        mkdirSync(dirname(destination), { recursive: true, mode: 0o700 })
        writeCredentialFileAtomic(destination, encrypted, () => generation === version, true)
      } catch {
        throw new Error('Unable to securely save the Itsaplan connection.')
      }
      return { connected: true, baseUrl: record.baseUrl, webBaseUrl: record.webBaseUrl }
    },
    disconnect: async (expectedBaseUrl) => {
      if (expectedBaseUrl !== undefined && read()?.baseUrl !== expectedBaseUrl) {
        throw new Error('The Itsaplan server changed. Refresh Tasks before continuing.')
      }
      generation += 1
      try {
        rmSync(filePath(), { force: true })
      } catch {
        throw new Error('Unable to remove the saved Itsaplan connection.')
      }
    }
  }
}

export const itsaplanConnection = createItsaplanConnection()
