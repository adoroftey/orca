import { z } from 'zod'
import { ItsaplanId } from './schemas'
const nullableString = z.string().nullable()
export const InitiativeSchema = z
  .object({
    id: ItsaplanId,
    projectId: ItsaplanId,
    title: z.string(),
    description: z.string(),
    status: z.string(),
    ownerUserId: nullableString,
    priority: nullableString,
    startDate: nullableString,
    targetDate: nullableString,
    position: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
    labelIds: z.array(ItsaplanId),
    progress: z
      .object({ completed: z.number(), canceled: z.number(), total: z.number() })
      .passthrough(),
    health: nullableString
  })
  .passthrough()
export const InitiativeInputSchema = z
  .object({
    title: z.string().trim().min(1).max(10000),
    description: z.string().max(50000).optional(),
    status: z.enum(['proposed', 'planned', 'active', 'completed', 'canceled']).optional(),
    ownerUserId: nullableString.optional(),
    priority: nullableString.optional(),
    startDate: nullableString.optional(),
    targetDate: nullableString.optional(),
    labelIds: z.array(ItsaplanId).optional()
  })
  .strict()
export const ViewSchema = z
  .object({
    id: ItsaplanId,
    projectId: ItsaplanId,
    name: z.string(),
    icon: nullableString,
    filters: z.record(z.string(), z.unknown()),
    display: z.record(z.string(), z.unknown()),
    position: z.number(),
    isPrivate: z.boolean().optional(),
    favorite: z.boolean().optional(),
    hidden: z.boolean().optional(),
    createdAt: z.string()
  })
  .passthrough()
export const ViewInputSchema = z
  .object({
    name: z.string().trim().min(1).max(10000),
    icon: nullableString.optional(),
    filters: z.record(z.string(), z.unknown()).optional(),
    display: z.record(z.string(), z.unknown()).optional(),
    isPrivate: z.boolean().optional()
  })
  .strict()
export const DashboardSchema = z
  .object({
    id: ItsaplanId,
    projectId: ItsaplanId,
    name: z.string(),
    icon: nullableString,
    layout: z.array(z.unknown()),
    position: z.number(),
    createdAt: z.string()
  })
  .passthrough()
export const DashboardInputSchema = z
  .object({
    name: z.string().trim().min(1).max(10000),
    icon: nullableString.optional(),
    layout: z.array(z.unknown()).optional()
  })
  .strict()
export const ActivityPageSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: ItsaplanId,
          kind: z.string(),
          actorName: nullableString,
          body: nullableString,
          createdAt: z.string()
        })
        .passthrough()
    ),
    nextCursor: z.object({ ts: z.string(), id: ItsaplanId }).strict().nullable()
  })
  .passthrough()
export const ListOptionsSchema = z
  .object({
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().min(1).max(500).optional(),
    status: z.string().optional(),
    search: z.string().optional(),
    sort: z.enum(['title', 'priority', 'targetDate', 'owner']).optional(),
    dir: z.enum(['asc', 'desc']).optional()
  })
  .strict()
export const FeedOptionsSchema = z
  .object({
    cursor: z
      .object({ ts: z.string().max(100), id: ItsaplanId })
      .strict()
      .optional(),
    limit: z.number().int().min(1).max(100).optional()
  })
  .strict()
export const AnalyticsKindSchema = z.enum([
  'stats',
  'breakdown',
  'pulse',
  'throughput',
  'burnup',
  'activity',
  'agent-runs',
  'agent-run-stats',
  'webhook-stats',
  'agent-workload'
])
export const AnalyticsQuerySchema = z
  .object({
    by: z.enum(['status', 'priority', 'type', 'assignee', 'delegate']).optional(),
    scope: z.enum(['project', 'me']).optional(),
    unit: z.enum(['hour', 'day', 'week']).optional(),
    columns: z.number().int().positive().optional(),
    weeks: z.number().int().positive().optional(),
    days: z.number().int().positive().optional(),
    initiativeId: ItsaplanId.optional(),
    forecastWeeks: z.number().int().positive().optional(),
    limit: z.number().int().positive().optional(),
    cursor: z.object({ ts: z.string(), id: ItsaplanId }).strict().optional(),
    actorUserId: z.string().optional(),
    action: z.string().optional(),
    status: z.enum(['pending', 'success', 'failed']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    issueIds: z.string().optional()
  })
  .strict()
