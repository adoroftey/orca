import type { ItsaplanApi, ItsaplanConnectionStatus } from './types'

export type ItsaplanCaller = <T>(method: string, params?: unknown) => Promise<T>

export function createItsaplanTransportApi(call: ItsaplanCaller): ItsaplanApi {
  const planning = <T>(operation: string, args: Record<string, unknown> = {}) =>
    call<T>('planning', { operation, args })
  return {
    planning: {
      capabilities: () => planning('capabilities'),
      listInitiatives: (projectRef, options) =>
        planning('listInitiatives', { projectRef, options }),
      getInitiative: (id) => planning('getInitiative', { id }),
      createInitiative: (projectRef, input) => planning('createInitiative', { projectRef, input }),
      updateInitiative: (id, updates) => planning('updateInitiative', { id, updates }),
      deleteInitiative: (id) => planning('deleteInitiative', { id }),
      initiativeFeed: (id, options) => planning('initiativeFeed', { id, options }),
      listViews: (projectRef) => planning('listViews', { projectRef }),
      createView: (projectRef, input) => planning('createView', { projectRef, input }),
      updateView: (id, updates) => planning('updateView', { id, updates }),
      deleteView: (id) => planning('deleteView', { id }),
      favoriteView: (id, favorite) => planning('favoriteView', { id, favorite }),
      hideView: (id, hidden) => planning('hideView', { id, hidden }),
      publishView: (id) => planning('publishView', { id }),
      reorderViews: (projectRef, orderedIds) =>
        planning('reorderViews', { projectRef, orderedIds }),
      arrangeViewTabs: (projectRef, orderedIds) =>
        planning('arrangeViewTabs', { projectRef, orderedIds }),
      listDashboards: (projectRef) => planning('listDashboards', { projectRef }),
      createDashboard: (projectRef, input) => planning('createDashboard', { projectRef, input }),
      updateDashboard: (id, updates) => planning('updateDashboard', { id, updates }),
      deleteDashboard: (id) => planning('deleteDashboard', { id }),
      reorderDashboards: (projectRef, orderedIds) =>
        planning('reorderDashboards', { projectRef, orderedIds }),
      analytics: (projectRef, kind, query) => planning('analytics', { projectRef, kind, query })
    },
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
