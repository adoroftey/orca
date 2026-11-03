import { createPlanningFacade } from './planning-support'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { z } from 'zod'
import { getSecretStore, type SecretStore } from '../../shared/secret-store'
import type {
  ItsaplanApi,
  ItsaplanConnectionStatus,
  ItsaplanRestApi
} from '../../shared/itsaplan/types'
import { ItsaplanConnectSchema } from '../../shared/itsaplan/schemas'
import { writeCredentialFileAtomic } from '../credentials/integration-credential-file'
import { createItsaplanClient } from './client'
import { authorizeItsaplanOAuth, refreshItsaplanOAuth } from './oauth'
import { createItsaplanOAuthTransport } from './oauth-transport'
import type { OAuthSession } from './oauth-storage-schema'
import { StoredConnection } from './oauth-storage-schema'
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

export function createItsaplanConnection(
  options: {
    filePath?: () => string
    fetch?: typeof fetch
    secretStore?: () => SecretStore
    openExternal?: (url: string) => Promise<void>
  } = {}
): ItsaplanConnection {
  const filePath = options.filePath ?? getItsaplanConnectionFile
  const secretStore = options.secretStore ?? getSecretStore
  let generation = 0
  let activeFlow: { controller: AbortController; destination: string } | undefined
  const refreshFlights = new Map<string, Promise<z.infer<typeof OAuthSession>>>()
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
      ? {
          connected: true,
          baseUrl: record.baseUrl,
          webBaseUrl: record.webBaseUrl,
          ...('auth' in record ? { authMethod: 'oauth' as const } : {})
        }
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
    if ('auth' in record) {
      const destination = filePath()
      const version = generation
      const identity = record.auth.session
      const getCredential = async (force = false) => {
        const current = read()
        if (
          !current ||
          !('auth' in current) ||
          filePath() !== destination ||
          generation !== version ||
          current.auth.session.issuer !== identity.issuer ||
          current.auth.session.clientId !== identity.clientId
        ) {
          throw new Error('The Itsaplan connection changed.')
        }
        if (!force && current.auth.session.expiresAt > Date.now() + 30_000) {
          return current.auth.session
        }
        const refreshKey = JSON.stringify([
          destination,
          version,
          identity.issuer,
          identity.clientId
        ])
        let refreshFlight = refreshFlights.get(refreshKey)
        if (!refreshFlight) {
          refreshFlight = (async () => {
            const original = current.auth.session
            const next = await refreshItsaplanOAuth(original, { fetch: options.fetch })
            const latest = read()
            if (
              filePath() !== destination ||
              generation !== version ||
              !latest ||
              !('auth' in latest) ||
              latest.auth.session.issuer !== original.issuer ||
              latest.auth.session.clientId !== original.clientId ||
              latest.auth.session.refreshToken !== original.refreshToken ||
              latest.auth.session.accessToken !== original.accessToken
            ) {
              throw new Error('The Itsaplan connection changed.')
            }
            const store = secretStore()
            if (!store.isEncryptionAvailable() || store.describeProtectionGap() !== null) {
              throw new Error('Secure credential storage is unavailable.')
            }
            writeCredentialFileAtomic(
              destination,
              store.encryptString(
                JSON.stringify({ ...latest, auth: { type: 'oauth', session: next } })
              ),
              () => generation === version && filePath() === destination,
              true
            )
            return next
          })().finally(() => {
            refreshFlights.delete(refreshKey)
          })
          refreshFlights.set(refreshKey, refreshFlight)
        }
        const refreshed = await refreshFlight
        if (filePath() !== destination || generation !== version) {
          throw new Error('The Itsaplan connection changed.')
        }
        return refreshed
      }
      return createItsaplanClient({
        baseUrl: record.baseUrl,
        transport: createItsaplanOAuthTransport({
          baseUrl: record.baseUrl,
          getCredential,
          fetch: options.fetch
        })
      })
    }
    return createItsaplanClient({ ...record, fetch: options.fetch })
  }
  const planning = (expectedBaseUrl?: string) =>
    createPlanningFacade(() => {
      const api = client(expectedBaseUrl).planning
      if (!api) {
        throw new Error('Planning is unavailable.')
      }
      return api
    })
  const restApi = (expectedBaseUrl?: string): ItsaplanRestApi => ({
    planning: planning(expectedBaseUrl),
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
        throw new Error('Enter valid Itsaplan connection details.')
      }
      const version = ++generation
      const destination = filePath()
      activeFlow?.controller.abort()
      const baseUrl = normalizeItsaplanServerUrl(parsed.data.baseUrl)
      const webBaseUrl = normalizeItsaplanServerUrl(
        parsed.data.webBaseUrl?.trim() || parsed.data.baseUrl
      )
      let record: z.infer<typeof StoredConnection>
      if (parsed.data.authMethod === 'oauth') {
        const controller = new AbortController()
        activeFlow = { controller, destination }
        try {
          const session = await authorizeItsaplanOAuth({
            baseUrl,
            fetch: options.fetch,
            signal: controller.signal,
            openExternal:
              options.openExternal ??
              (async (url) => {
                const { shell } = await import('electron')
                await shell.openExternal(url)
              })
          })
          await createItsaplanClient({
            baseUrl,
            transport: createItsaplanOAuthTransport({
              baseUrl,
              getCredential: async () => session,
              fetch: options.fetch,
              signal: controller.signal
            })
          }).listProjects()
          if (controller.signal.aborted) {
            throw new Error('Itsaplan sign-in cancelled.')
          }
          record = { baseUrl, webBaseUrl, auth: { type: 'oauth', session } }
        } finally {
          if (activeFlow?.controller === controller) {
            activeFlow = undefined
          }
        }
      } else {
        record = { baseUrl, webBaseUrl, apiKey: parsed.data.apiKey }
        await createItsaplanClient({ ...record, fetch: options.fetch }).listProjects()
      }
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
        writeCredentialFileAtomic(
          destination,
          encrypted,
          () => generation === version && filePath() === destination,
          true
        )
      } catch {
        throw new Error('Unable to securely save the Itsaplan connection.')
      }
      return {
        connected: true,
        baseUrl: record.baseUrl,
        webBaseUrl: record.webBaseUrl,
        ...('auth' in record ? { authMethod: 'oauth' as const } : {})
      }
    },
    cancelConnect: async () => {
      if (activeFlow && activeFlow.destination === filePath()) {
        generation += 1
        activeFlow.controller.abort()
        activeFlow = undefined
      }
    },
    disconnect: async (expectedBaseUrl) => {
      if (expectedBaseUrl !== undefined && read()?.baseUrl !== expectedBaseUrl) {
        throw new Error('The Itsaplan server changed. Refresh Tasks before continuing.')
      }
      generation += 1
      activeFlow?.controller.abort()
      activeFlow = undefined
      try {
        rmSync(filePath(), { force: true })
      } catch {
        throw new Error('Unable to remove the saved Itsaplan connection.')
      }
    }
  }
}

export const itsaplanConnection = createItsaplanConnection()
