import { z } from 'zod'
import type { ItsaplanRestApi } from '../../shared/itsaplan/types'
import {
  ItsaplanCommentOptionsSchema,
  ItsaplanCommentPageSchema,
  ItsaplanCommentSchema,
  ItsaplanId,
  ItsaplanIssueCreateSchema,
  ItsaplanIssueSchema,
  ItsaplanIssueSummarySchema,
  ItsaplanIssueUpdateSchema,
  ItsaplanProjectDetailsSchema,
  ItsaplanProjectRef,
  ItsaplanProjectSchema
} from '../../shared/itsaplan/schemas'
import { createItsaplanHttpClient } from './http-client'
import { createPlanningClient } from './planning-client'

export function createItsaplanClient(options: {
  baseUrl: string
  apiKey?: string
  transport?: (
    path: string,
    method: string,
    body?: unknown
  ) => Promise<{ status: number; data: unknown }>
  fetch?: typeof fetch
}): ItsaplanRestApi {
  const { request, validated } = createItsaplanHttpClient(options)
  const projectPath = (ref: string) =>
    `/projects/${encodeURIComponent(validated(ItsaplanProjectRef, ref))}`
  const issuePath = (id: number) => `/issues/${validated(ItsaplanId, id)}`
  return {
    planning: createPlanningClient(request, validated),
    listProjects: () => request('/projects', z.array(ItsaplanProjectSchema)),
    getProject: (ref) => request(projectPath(ref), ItsaplanProjectDetailsSchema),
    listIssues: async (ref) =>
      (
        await request(
          `${projectPath(ref)}/issues/board`,
          z.object({
            issues: z.array(ItsaplanIssueSchema)
          })
        )
      ).issues,
    searchIssues: (ref, query, limit = 500) => {
      const params = new URLSearchParams({
        q: validated(z.string().max(10_000), query),
        limit: String(validated(z.number().int().min(1).max(500), limit))
      })
      return request(
        `${projectPath(ref)}/issues/search?${params}`,
        z.array(ItsaplanIssueSummarySchema)
      )
    },
    getIssue: (id) => request(issuePath(id), ItsaplanIssueSchema),
    createIssue: (ref, input) =>
      request(
        `${projectPath(ref)}/issues`,
        ItsaplanIssueSchema,
        'POST',
        validated(ItsaplanIssueCreateSchema, input)
      ),
    updateIssue: (id, updates) =>
      request(
        issuePath(id),
        ItsaplanIssueSchema,
        'PATCH',
        validated(ItsaplanIssueUpdateSchema, updates)
      ),
    listComments: (id, options = {}) => {
      const page = validated(ItsaplanCommentOptionsSchema, options)
      const params = new URLSearchParams({
        filter: 'comments',
        order: 'asc',
        limit: String(page.limit ?? 100)
      })
      if (page.cursor) {
        params.set('cursor', JSON.stringify(page.cursor))
      }
      return request(`${issuePath(id)}/feed?${params}`, ItsaplanCommentPageSchema)
    },
    addComment: (id, body) =>
      request(`${issuePath(id)}/comments`, ItsaplanCommentSchema, 'POST', {
        body: validated(z.string().trim().min(1).max(50_000), body)
      })
  }
}
