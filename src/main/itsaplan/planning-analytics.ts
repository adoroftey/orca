import { z } from 'zod'
import type {
  PlanningAnalyticsKind,
  PlanningAnalyticsData
} from '../../shared/itsaplan/planning-types'
export const analyticsSchemas: Record<PlanningAnalyticsKind, z.ZodType<PlanningAnalyticsData>> = {
  stats: z
    .object({
      open: z.number(),
      inProgress: z.number(),
      backlog: z.number(),
      overdue: z.number(),
      unassigned: z.number(),
      closedLast7d: z.number()
    })
    .passthrough(),
  breakdown: z.array(
    z
      .object({
        key: z.string(),
        label: z.string(),
        count: z.number(),
        color: z.union([z.string(), z.null()])
      })
      .passthrough()
  ),
  pulse: z.array(z.object({ label: z.string(), count: z.number() }).passthrough()),
  throughput: z.array(
    z.object({ week: z.string(), created: z.number(), closed: z.number() }).passthrough()
  ),
  burnup: z
    .object({
      days: z.array(
        z
          .object({
            date: z.string(),
            scope: z.number(),
            started: z.number(),
            completed: z.number()
          })
          .passthrough()
      ),
      forecast: z
        .object({
          windowDays: z.number(),
          velocityPerDay: z.number(),
          scopeGrowthPerDay: z.number(),
          remaining: z.number(),
          projectedScope: z.number(),
          projectedDate: z.union([z.string(), z.null()]),
          optimisticDate: z.union([z.string(), z.null()]),
          pessimisticDate: z.union([z.string(), z.null()])
        })
        .passthrough(),
      targetDate: z.union([z.string(), z.null()])
    })
    .passthrough(),
  activity: z
    .object({
      items: z.array(
        z
          .object({
            id: z.number(),
            issueId: z.number(),
            issueSequence: z.number(),
            issueTitle: z.string(),
            kind: z.string(),
            actorUserId: z.union([z.string(), z.null()]),
            actorName: z.union([z.string(), z.null()]),
            body: z.union([z.string(), z.null()]),
            action: z.union([z.string(), z.null()]),
            payload: z
              .object({
                subject: z
                  .object({
                    value: z.union([z.string(), z.null()]),
                    id: z.union([z.union([z.number(), z.string()]), z.null()]).optional(),
                    stateType: z.union([z.string(), z.null()]).optional(),
                    repo: z.string().optional(),
                    number: z.number().optional(),
                    date: z.union([z.string(), z.null()]).optional()
                  })
                  .passthrough()
                  .optional(),
                from: z
                  .object({
                    value: z.union([z.string(), z.null()]),
                    id: z.union([z.union([z.number(), z.string()]), z.null()]).optional(),
                    stateType: z.union([z.string(), z.null()]).optional(),
                    repo: z.string().optional(),
                    number: z.number().optional(),
                    date: z.union([z.string(), z.null()]).optional()
                  })
                  .passthrough()
                  .optional(),
                to: z
                  .object({
                    value: z.union([z.string(), z.null()]),
                    id: z.union([z.union([z.number(), z.string()]), z.null()]).optional(),
                    stateType: z.union([z.string(), z.null()]).optional(),
                    repo: z.string().optional(),
                    number: z.number().optional(),
                    date: z.union([z.string(), z.null()]).optional()
                  })
                  .passthrough()
                  .optional()
              })
              .passthrough(),
            createdAt: z.string()
          })
          .passthrough()
      ),
      nextCursor: z.union([z.object({ ts: z.string(), id: z.number() }).passthrough(), z.null()])
    })
    .passthrough(),
  'agent-runs': z.array(
    z
      .object({
        id: z.number(),
        status: z.string(),
        trigger: z.union([
          z.literal('mention'),
          z.literal('delegation'),
          z.literal('field'),
          z.literal('schedule'),
          z.literal('manual'),
          z.literal('status'),
          z.literal('event')
        ]),
        agentId: z.number(),
        agentName: z.string(),
        issueId: z.union([z.number(), z.null()]),
        issueSequence: z.union([z.number(), z.null()]),
        lastError: z.union([z.string(), z.null()]),
        createdAt: z.string()
      })
      .passthrough()
  ),
  'agent-run-stats': z
    .object({ total: z.number(), success: z.number(), failed: z.number(), pending: z.number() })
    .passthrough(),
  'webhook-stats': z
    .object({
      total: z.number(),
      success: z.number(),
      failed: z.number(),
      pending: z.number(),
      activeWebhooks: z.number(),
      disabledWebhooks: z.number()
    })
    .passthrough(),
  'agent-workload': z.array(
    z
      .object({
        agentId: z.number(),
        agentName: z.string(),
        kind: z.string(),
        delegatedOpen: z.number(),
        runsTotal: z.number(),
        runsSuccess: z.number(),
        runsFailed: z.number()
      })
      .passthrough()
  )
}
export const analyticsKeys: Record<PlanningAnalyticsKind, readonly string[]> = {
  stats: [],
  breakdown: ['by'],
  pulse: ['scope', 'unit', 'columns'],
  throughput: ['weeks'],
  burnup: ['days', 'initiativeId', 'forecastWeeks'],
  activity: ['limit', 'cursor', 'actorUserId', 'action', 'from', 'to', 'issueIds'],
  'agent-runs': ['status', 'limit'],
  'agent-run-stats': ['days'],
  'webhook-stats': ['days'],
  'agent-workload': []
}
