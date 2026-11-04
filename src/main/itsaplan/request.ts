import { dispatchPlanningRequest } from './planning-request'
import { ItsaplanRequestParams } from '../../shared/rpc-contract/itsaplan-params'
import { itsaplanConnection } from './connection'

export async function dispatchItsaplanRequest(input: unknown): Promise<unknown> {
  const parsed = ItsaplanRequestParams.safeParse(input)
  if (!parsed.success) {
    throw new Error('Invalid Itsaplan request parameters.')
  }
  const request = parsed.data
  switch (request.method) {
    case 'planning':
      return dispatchPlanningRequest(request.params)
    case 'status':
      return itsaplanConnection.status()
    case 'cancelConnect':
      return itsaplanConnection.cancelConnect?.()
    case 'connect':
      return itsaplanConnection.connect(request.params)
    case 'disconnect':
      return itsaplanConnection.disconnect(request.params.expectedBaseUrl)
    case 'listProjects':
      return itsaplanConnection.forServer(request.params.expectedBaseUrl).listProjects()
    case 'getProject':
      return itsaplanConnection
        .forServer(request.params.expectedBaseUrl)
        .getProject(request.params.projectRef)
    case 'listIssues':
      return itsaplanConnection
        .forServer(request.params.expectedBaseUrl)
        .listIssues(request.params.projectRef)
    case 'searchIssues':
      return itsaplanConnection
        .forServer(request.params.expectedBaseUrl)
        .searchIssues(request.params.projectRef, request.params.query, request.params.limit)
    case 'getIssue':
      return itsaplanConnection
        .forServer(request.params.expectedBaseUrl)
        .getIssue(request.params.issueId)
    case 'createIssue':
      return itsaplanConnection
        .forServer(request.params.expectedBaseUrl)
        .createIssue(request.params.projectRef, request.params.input)
    case 'updateIssue':
      return itsaplanConnection
        .forServer(request.params.expectedBaseUrl)
        .updateIssue(request.params.issueId, request.params.updates)
    case 'listComments':
      return itsaplanConnection
        .forServer(request.params.expectedBaseUrl)
        .listComments(request.params.issueId, request.params.options)
    case 'addComment':
      return itsaplanConnection
        .forServer(request.params.expectedBaseUrl)
        .addComment(request.params.issueId, request.params.body)
  }
}
