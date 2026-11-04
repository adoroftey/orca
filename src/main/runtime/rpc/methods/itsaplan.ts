import { ItsaplanPlanningParams } from '../../../../shared/rpc-contract/itsaplan-planning-params'
import { defineMethod } from '../core'
import {
  ItsaplanAddCommentParams,
  ItsaplanCommentsParams,
  ItsaplanConnectParams,
  ItsaplanCreateParams,
  ItsaplanIssueParams,
  ItsaplanProjectParams,
  ItsaplanSearchParams,
  ItsaplanScopeParams,
  ItsaplanUpdateParams
} from '../../../../shared/rpc-contract/itsaplan-params'
import { dispatchItsaplanRequest } from '../../../itsaplan/request'

export const ITSAPLAN_METHODS = [
  defineMethod({
    name: 'itsaplan.planning',
    permission: 'workspace',
    params: ItsaplanPlanningParams,
    handler: async (params) =>
      (await dispatchItsaplanRequest({ method: 'planning', params })) ?? null
  }),
  defineMethod({
    name: 'itsaplan.connect',
    permission: 'accounts-admin',
    params: ItsaplanConnectParams,
    handler: (params) => {
      if (params.authMethod === 'oauth') {
        throw new Error('OAuth sign-in is available only on the local desktop.')
      }
      return dispatchItsaplanRequest({ method: 'connect', params })
    }
  }),
  defineMethod({
    name: 'itsaplan.cancelConnect',
    permission: 'accounts-admin',
    params: null,
    handler: () => {
      throw new Error('OAuth sign-in is available only on the local desktop.')
    }
  }),
  defineMethod({
    name: 'itsaplan.disconnect',
    permission: 'accounts-admin',
    params: ItsaplanScopeParams,
    handler: (params) => dispatchItsaplanRequest({ method: 'disconnect', params })
  }),
  defineMethod({
    name: 'itsaplan.status',
    permission: 'workspace',
    params: null,
    handler: () => dispatchItsaplanRequest({ method: 'status' })
  }),
  defineMethod({
    name: 'itsaplan.listProjects',
    permission: 'workspace',
    params: ItsaplanScopeParams,
    handler: (params) => dispatchItsaplanRequest({ method: 'listProjects', params })
  }),
  defineMethod({
    name: 'itsaplan.getProject',
    permission: 'workspace',
    params: ItsaplanProjectParams,
    handler: (params) => dispatchItsaplanRequest({ method: 'getProject', params })
  }),
  defineMethod({
    name: 'itsaplan.listIssues',
    permission: 'workspace',
    params: ItsaplanProjectParams,
    handler: (params) => dispatchItsaplanRequest({ method: 'listIssues', params })
  }),
  defineMethod({
    name: 'itsaplan.searchIssues',
    permission: 'workspace',
    params: ItsaplanSearchParams,
    handler: (params) => dispatchItsaplanRequest({ method: 'searchIssues', params })
  }),
  defineMethod({
    name: 'itsaplan.getIssue',
    permission: 'workspace',
    params: ItsaplanIssueParams,
    handler: (params) => dispatchItsaplanRequest({ method: 'getIssue', params })
  }),
  defineMethod({
    name: 'itsaplan.createIssue',
    permission: 'workspace',
    params: ItsaplanCreateParams,
    handler: (params) => dispatchItsaplanRequest({ method: 'createIssue', params })
  }),
  defineMethod({
    name: 'itsaplan.updateIssue',
    permission: 'workspace',
    params: ItsaplanUpdateParams,
    handler: (params) => dispatchItsaplanRequest({ method: 'updateIssue', params })
  }),
  defineMethod({
    name: 'itsaplan.listComments',
    permission: 'workspace',
    params: ItsaplanCommentsParams,
    handler: (params) => dispatchItsaplanRequest({ method: 'listComments', params })
  }),
  defineMethod({
    name: 'itsaplan.addComment',
    permission: 'workspace',
    params: ItsaplanAddCommentParams,
    handler: (params) => dispatchItsaplanRequest({ method: 'addComment', params })
  })
] as const
