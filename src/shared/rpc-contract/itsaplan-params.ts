import { z } from 'zod'
import { ItsaplanPlanningParams } from './itsaplan-planning-params'
import {
  ItsaplanCommentOptionsSchema,
  ItsaplanConnectSchema,
  ItsaplanId,
  ItsaplanIssueCreateSchema,
  ItsaplanIssueUpdateSchema,
  ItsaplanProjectRef
} from '../itsaplan/schemas'

export const ItsaplanConnectParams = ItsaplanConnectSchema
export const ItsaplanScopeParams = z
  .object({ expectedBaseUrl: z.string().min(1).max(2_048) })
  .strict()
export const ItsaplanProjectParams = ItsaplanScopeParams.extend({ projectRef: ItsaplanProjectRef })
export const ItsaplanIssueParams = ItsaplanScopeParams.extend({ issueId: ItsaplanId })
export const ItsaplanSearchParams = ItsaplanProjectParams.extend({
  query: z.string().max(10_000),
  limit: z.number().int().min(1).max(500).optional()
})
export const ItsaplanCreateParams = ItsaplanProjectParams.extend({
  input: ItsaplanIssueCreateSchema
})
export const ItsaplanUpdateParams = ItsaplanIssueParams.extend({
  updates: ItsaplanIssueUpdateSchema
})
export const ItsaplanCommentsParams = ItsaplanIssueParams.extend({
  options: ItsaplanCommentOptionsSchema.optional()
})
export const ItsaplanAddCommentParams = ItsaplanIssueParams.extend({
  body: z.string().trim().min(1).max(50_000)
})

export const ItsaplanRequestParams = z.discriminatedUnion('method', [
  z.object({ method: z.literal('planning'), params: ItsaplanPlanningParams }).strict(),
  z.object({ method: z.literal('status') }).strict(),
  z.object({ method: z.literal('connect'), params: ItsaplanConnectParams }).strict(),
  z.object({ method: z.literal('disconnect'), params: ItsaplanScopeParams }).strict(),
  z.object({ method: z.literal('listProjects'), params: ItsaplanScopeParams }).strict(),
  z.object({ method: z.literal('getProject'), params: ItsaplanProjectParams }).strict(),
  z.object({ method: z.literal('listIssues'), params: ItsaplanProjectParams }).strict(),
  z.object({ method: z.literal('searchIssues'), params: ItsaplanSearchParams }).strict(),
  z.object({ method: z.literal('getIssue'), params: ItsaplanIssueParams }).strict(),
  z.object({ method: z.literal('createIssue'), params: ItsaplanCreateParams }).strict(),
  z.object({ method: z.literal('updateIssue'), params: ItsaplanUpdateParams }).strict(),
  z.object({ method: z.literal('listComments'), params: ItsaplanCommentsParams }).strict(),
  z.object({ method: z.literal('addComment'), params: ItsaplanAddCommentParams }).strict()
])

export type ItsaplanRequest = z.infer<typeof ItsaplanRequestParams>
