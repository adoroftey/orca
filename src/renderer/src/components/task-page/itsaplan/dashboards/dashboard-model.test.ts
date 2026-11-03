import { describe, expect, it } from 'vitest'
import { readDashboardWidgets, replaceDashboardWidget } from './dashboard-model'

describe('dashboard layout', () => {
  it('retains future entries and maps their source indexes without mutating the source', () => {
    const raw = [
      { id: 'a', type: 'stat', size: 'half', config: { future: 2 } },
      null,
      { type: 'future', extra: true }
    ]
    const result = readDashboardWidgets(raw)
    expect(result.map((w) => w.sourceIndex)).toEqual([0, 1, 2])
    expect(result[0]).toMatchObject({ w: 6, x: 0, config: { future: 2 } })
    expect(result[2].raw).toEqual(raw[2])
    expect(replaceDashboardWidget(raw, 0, { title: 'New' })[0]).toEqual({ ...raw[0], title: 'New' })
    expect(replaceDashboardWidget(raw, 1, { title: 'New' })[1]).toBeNull()
    expect(replaceDashboardWidget(raw, 0, { config: { limit: 4 } })[0]).toMatchObject({
      config: { future: 2, limit: 4 }
    })
    expect(raw[0]).not.toHaveProperty('title')
  })
  it('derives catalogue geometry without changing legacy data', () => {
    const raw = [{ type: 'stat' }, { type: 'recent_issues', size: 'half' }, { type: 'pulse' }]
    expect(readDashboardWidgets(raw).map(({ w, h }) => [w, h])).toEqual([
      [3, 3],
      [6, 7],
      [12, 5]
    ])
    expect(raw).toEqual([
      { type: 'stat' },
      { type: 'recent_issues', size: 'half' },
      { type: 'pulse' }
    ])
  })
  it('moving a widget preserves another widget and its future configuration', () => {
    const other = { type: 'future', config: { limit: 999, custom: { enabled: true } } }
    const layout = [{ type: 'stat', x: 0 }, other]
    expect(replaceDashboardWidget(layout, 0, { x: 2 })[1]).toEqual(other)
  })
})
