import type { ItsaplanApi, ItsaplanConnectionStatus } from './types'

export type ItsaplanCaller = <T>(method: string, params?: unknown) => Promise<T>

export function createItsaplanTransportApi(call: ItsaplanCaller): ItsaplanApi {
  return {
    status: () => call('status'),
    connect: (params) => call('connect', params),
    disconnect: () => call('disconnect'),
    listProjects: () => call('listProjects'),
    getProject: (projectRef) => call('getProject', { projectRef }),
    listIssues: (projectRef) => call('listIssues', { projectRef }),
    searchIssues: (projectRef, query, limit) => call('searchIssues', { projectRef, query, limit }),
    getIssue: (issueId) => call('getIssue', { issueId }),
    createIssue: (projectRef, input) => call('createIssue', { projectRef, input }),
    updateIssue: (issueId, updates) => call('updateIssue', { issueId, updates }),
    listComments: (issueId, options) => call('listComments', { issueId, options }),
    addComment: (issueId, body) => call('addComment', { issueId, body })
  }
}

export function createItsaplanScopedTransportApi(call: ItsaplanCaller): ItsaplanApi {
  let expectedBaseUrl: string | null = null
  const rememberConnection = async (method: 'status' | 'connect', params?: unknown) => {
    const result = await call<ItsaplanConnectionStatus>(method, params)
    expectedBaseUrl = result.connected ? result.baseUrl : null
    return result
  }
  const api = createItsaplanTransportApi(
    async <T>(method: string, params?: unknown): Promise<T> => {
      if (!expectedBaseUrl) {
        throw new Error('Connect Itsaplan or refresh Tasks before continuing.')
      }
      const requestParams = typeof params === 'object' && params !== null ? params : {}
      const result = await call<T>(method, { ...requestParams, expectedBaseUrl })
      if (method === 'disconnect') {
        expectedBaseUrl = null
      }
      return result
    }
  )
  return {
    ...api,
    status: () => rememberConnection('status'),
    connect: (params) => rememberConnection('connect', params)
  }
}
