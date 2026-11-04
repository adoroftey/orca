export type PlanningWidget = {
  id: string
  type: string
  x: number
  y: number
  w: number
  h: number
  title?: string
  config: Record<string, unknown>
  sourceIndex: number
  raw: Record<string, unknown>
}
export const KNOWN_WIDGET_TYPES = [
  'stat',
  'recent_issues',
  'activity_feed',
  'pulse',
  'throughput',
  'burnup',
  'breakdown',
  'agent_runs',
  'agent_health',
  'webhook_health',
  'agent_workload'
] as const
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const number = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback
export function readDashboardWidgets(layout: unknown[]): PlanningWidget[] {
  let x = 0,
    y = 0,
    rowHeight = 0
  return layout.map((entry, sourceIndex) => {
    const raw = object(entry) ? entry : {}
    const defaults: Record<string, [number, number]> = {
      stat: [3, 3],
      recent_issues: [6, 7],
      activity_feed: [6, 7],
      pulse: [12, 5],
      throughput: [6, 6],
      burnup: [6, 6],
      breakdown: [6, 6],
      agent_runs: [6, 7],
      agent_health: [3, 3],
      webhook_health: [3, 3],
      agent_workload: [6, 6]
    }
    const [defaultW, defaultH] = defaults[typeof raw.type === 'string' ? raw.type : ''] ?? [12, 1]
    const legacyWidth =
      raw.size === 'half' ? 6 : raw.size === 'quarter' ? 3 : raw.size === 'full' ? 12 : defaultW
    const w = Math.max(1, Math.min(12, number(raw.w, legacyWidth)))
    const h = Math.max(1, number(raw.h, defaultH))
    if (x + w > 12) {
      x = 0
      y += rowHeight
      rowHeight = 0
    }
    const widgetX = Math.max(0, Math.min(12 - w, number(raw.x, x)))
    const widgetY = Math.max(0, number(raw.y, y))
    x += w
    rowHeight = Math.max(rowHeight, h)
    return {
      id: typeof raw.id === 'string' ? raw.id : `unsupported-${sourceIndex}`,
      type: typeof raw.type === 'string' ? raw.type : '',
      x: widgetX,
      y: widgetY,
      w,
      h,
      ...(typeof raw.title === 'string' ? { title: raw.title } : {}),
      config: object(raw.config) ? raw.config : {},
      sourceIndex,
      raw
    }
  })
}
export function replaceDashboardWidget(
  layout: unknown[],
  index: number,
  updates: Record<string, unknown>
): unknown[] {
  return layout.map((entry, i) =>
    i === index && object(entry)
      ? {
          ...entry,
          ...updates,
          ...(object(entry.config) && object(updates.config)
            ? { config: { ...entry.config, ...updates.config } }
            : {})
        }
      : entry
  )
}
