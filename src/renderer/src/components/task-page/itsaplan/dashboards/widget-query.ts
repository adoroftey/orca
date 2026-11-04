import type {
  PlanningAnalyticsKind,
  PlanningAnalyticsQuery
} from '../../../../../../shared/itsaplan/planning-types'

const numeric = (v: unknown, fallback: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(1, Math.min(max, Math.floor(v))) : fallback
const valid = (v: unknown, options: readonly string[]) =>
  v == null || (typeof v === 'string' && options.includes(v))
function isFilterObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
export function invalidWidgetConfig(type: string, c: Record<string, unknown>): boolean {
  if (
    (type === 'stat' || type === 'recent_issues') &&
    c.filters != null &&
    !isFilterObject(c.filters)
  ) {
    return true
  }
  switch (type) {
    case 'recent_issues':
      return !valid(c.sort, ['updated', 'created'])
    case 'activity_feed':
      return (
        (c.action != null && typeof c.action !== 'string') ||
        (c.actorUserId != null && typeof c.actorUserId !== 'string')
      )
    case 'pulse':
      return (
        !valid(c.pulseScope, ['project', 'me']) || !valid(c.granularity, ['day', 'hour', 'week'])
      )
    case 'burnup':
      return !valid(c.forecast, ['line', 'range', 'none'])
    case 'breakdown':
      return !valid(c.by, ['status', 'priority', 'type', 'assignee', 'delegate'])
    case 'agent_runs':
      return !valid(c.runStatus, ['', 'pending', 'success', 'failed'])
    default:
      return false
  }
}
export function widgetLimit(c: Record<string, unknown>, fallback: number): number {
  return numeric(c.limit, fallback, 100)
}
export function request(
  type: string,
  c: Record<string, unknown>
): { kind: PlanningAnalyticsKind; query: PlanningAnalyticsQuery } | null {
  if (invalidWidgetConfig(type, c)) {
    return null
  }
  switch (type) {
    case 'activity_feed':
      return {
        kind: 'activity',
        query: {
          limit: widgetLimit(c, 20),
          ...(typeof c.actorUserId === 'string' && c.actorUserId
            ? { actorUserId: c.actorUserId }
            : {}),
          ...(typeof c.action === 'string' && c.action ? { action: c.action } : {})
        }
      }
    case 'pulse':
      return {
        kind: 'pulse',
        query: {
          scope: c.pulseScope === 'me' ? 'me' : 'project',
          unit: c.granularity === 'hour' || c.granularity === 'week' ? c.granularity : 'day',
          columns: 26
        }
      }
    case 'throughput':
      return { kind: 'throughput', query: { weeks: numeric(c.weeks, 12, 52) } }
    case 'burnup':
      return {
        kind: 'burnup',
        query: {
          days: numeric(c.days, 90, 365),
          forecastWeeks: numeric(c.forecastWeeks, 4, 52),
          ...(typeof c.initiativeId === 'number' &&
          Number.isFinite(c.initiativeId) &&
          c.initiativeId > 0
            ? { initiativeId: c.initiativeId }
            : {})
        }
      }
    case 'breakdown':
      return {
        kind: 'breakdown',
        query: {
          by:
            c.by === 'priority' || c.by === 'type' || c.by === 'assignee' || c.by === 'delegate'
              ? c.by
              : 'status'
        }
      }
    case 'agent_runs':
      return {
        kind: 'agent-runs',
        query: {
          limit: widgetLimit(c, 20),
          ...(c.runStatus === 'pending' || c.runStatus === 'success' || c.runStatus === 'failed'
            ? { status: c.runStatus }
            : {})
        }
      }
    case 'agent_health':
      return { kind: 'agent-run-stats', query: { days: numeric(c.days, 30, 365) } }
    case 'webhook_health':
      return { kind: 'webhook-stats', query: { days: numeric(c.days, 30, 365) } }
    case 'agent_workload':
      return { kind: 'agent-workload', query: {} }
    default:
      return null
  }
}
