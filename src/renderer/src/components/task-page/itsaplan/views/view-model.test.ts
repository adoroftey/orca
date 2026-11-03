import { describe, expect, it, vi } from 'vitest'
import { rawValues } from './view-values'
import type { ItsaplanIssue, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
import {
  applyPlanningFilters,
  groupPlanningIssues,
  planningIssueDate,
  planningIssueProperty,
  sortPlanningIssues
} from './view-model'

const metadata: ItsaplanProjectDetails = {
  project: { id: 1, key: 'P', ref: 'p', name: 'P' },
  columns: [
    { id: 1, name: 'Open', stateType: 'started', color: '', position: 0 },
    { id: 2, name: 'Done', stateType: 'completed', color: '', position: 1 }
  ],
  assignees: [{ userId: 'u', name: 'Ada', kind: 'member' }],
  issueTypes: [{ id: 3, name: 'Bug' }],
  labels: [{ id: 7, name: 'Red' }],
  customFields: [
    { id: 9, name: 'Choice', fieldType: 'select', options: [{ id: 4, name: 'Blue' }] },
    { id: 10, name: 'Owner', fieldType: 'member' },
    { id: 11, name: 'Text', fieldType: 'text' },
    { id: 12, name: 'Number', fieldType: 'number' },
    { id: 13, name: 'Date', fieldType: 'date' }
  ]
}
const issue = (id: number, patch: Partial<ItsaplanIssue> = {}): ItsaplanIssue => ({
  id,
  sequenceNumber: id,
  identifier: `P-${id}`,
  title: `Issue ${id}`,
  columnId: 1,
  assigneeUserId: null,
  priority: null,
  projectId: 1,
  description: '',
  createdAt: '2025-01-01',
  updatedAt: '2025-01-02',
  ...patch
})
const a = issue(1, {
  assigneeUserId: 'u',
  priority: 'high',
  typeId: 3,
  labelIds: [7],
  dueDate: '2025-02-01',
  initiativeId: 11,
  initiative: { id: 11, title: 'Plan', status: 'active' },
  cycleId: 5,
  cycle: { id: 5, name: 'Sprint', status: 'active' },
  fieldValues: [
    { fieldId: 9, value: 'ignored', optionIds: [4] },
    { fieldId: 10, value: 'u', optionIds: [] },
    { fieldId: 11, value: 'Hello World', optionIds: [] },
    { fieldId: 12, value: 42, optionIds: [] },
    { fieldId: 13, value: { start: '2025-03-01', end: '2025-03-05' }, optionIds: [] }
  ]
})
const b = issue(2, { columnId: 2, priority: 'urgent' })
const condition = (field: string, op: string, values: unknown[] = []) => ({
  id: 'x',
  field,
  op,
  values
})
const filtered = (...conditions: unknown[]) =>
  applyPlanningFilters([a, b], { conditions }, metadata)

describe('saved planning view semantics', () => {
  it('uses actual member metadata for labels and grouping', () => {
    expect(planningIssueProperty(a, 'cf:10', metadata)).toBe('Ada')
    expect(groupPlanningIssues([a], 'cf:10', metadata)[0]?.label).toBe('Ada')
  })
  it('displays saved estimate and status age properties', () => {
    const estimated = issue(4, { estimatePoints: 3, estimateMinutes: 90, statusSince: 'invalid' })
    expect(planningIssueProperty(estimated, 'estimatePoints', metadata)).toBe('3')
    expect(planningIssueProperty(estimated, 'estimateTime', metadata)).toMatch(/1.*30/)
    expect(rawValues(estimated, 'estimatePoints', metadata)).toEqual([3])
    expect(rawValues(estimated, 'estimateTime', metadata)).toEqual([90])
    expect(planningIssueProperty(estimated, 'statusAge', metadata)).not.toContain('NaN')
    expect(planningIssueProperty(estimated, 'statusAge', metadata)).toBe('None')
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2025-01-03T00:00:00Z'))
      expect(
        planningIssueProperty(
          issue(5, { statusSince: '2025-01-01T00:00:00Z' }),
          'statusAge',
          metadata
        )
      ).toBe('2 days ago')
    } finally {
      vi.useRealTimers()
    }
  })
  it('accepts conditions without an id', () => {
    expect(filtered({ field: 'status', op: 'is', values: [1] }).issues).toEqual([a])
  })
  it('rejects text and date operators for incompatible fields', () => {
    expect(filtered(condition('assignee', 'contains', ['u'])).unsupported).toEqual([
      'assignee:contains'
    ])
    expect(filtered(condition('cf:11', 'before', ['2025-01-01'])).unsupported).toEqual([
      'cf:11:before'
    ])
    expect(filtered(condition('cf:13', 'before', ['2025-03-02'])).issues).toEqual([a])
    expect(filtered(condition('cf:13', 'after', ['2025-03-01'])).issues).toEqual([])
  })
  it('applies AND, strict IDs, status type and initiative/cycle status selectors', () => {
    expect(
      filtered(
        condition('status', 'is', [1]),
        condition('statusType', 'is', ['started']),
        condition('initiative', 'is', ['status:active']),
        condition('cycle', 'is', [5])
      ).issues
    ).toEqual([a])
    expect(filtered(condition('status', 'is', ['1'])).issues).toEqual([])
  })
  it('handles overlap, missing labels and presence operators', () => {
    expect(filtered(condition('labels', 'is', [null])).issues).toEqual([b])
    expect(filtered(condition('labels', 'is_not', [7])).issues).toEqual([b])
    expect(filtered(condition('assignee', 'is_set')).issues).toEqual([a])
    expect(filtered(condition('assignee', 'is_not_set')).issues).toEqual([b])
    expect(filtered(condition('status', 'is', [])).issues).toEqual([a, b])
  })
  it('compares date boundaries and custom values', () => {
    expect(filtered(condition('dueDate', 'before', ['2025-02-02'])).issues).toEqual([a])
    expect(filtered(condition('dueDate', 'after', ['2025-02-01'])).issues).toEqual([])
    expect(
      filtered(
        condition('cf:9', 'is', [4]),
        condition('cf:11', 'contains', ['WORLD']),
        condition('cf:12', 'is', [42])
      ).issues
    ).toEqual([a])
    expect(filtered(condition('cf:11', 'not_contains', ['world'])).issues).toEqual([b])
  })
  it('fails closed on unknown effective root filters while preserving the input', () => {
    for (const filters of [{ futureFilter: 'value' }, { conditions: [], futureFilter: 'value' }]) {
      const original = JSON.stringify(filters)
      const result = applyPlanningFilters([a, b], filters, metadata)
      expect(result.issues).toEqual([])
      expect(result.unsupported.length).toBeGreaterThan(0)
      expect(JSON.stringify(filters)).toBe(original)
    }
    expect(
      applyPlanningFilters(
        [a, b],
        { future: null, other: false, blank: '', list: [], object: {} },
        metadata
      ).issues
    ).toEqual([a, b])
  })
  it('fails closed on malformed or unknown effective conditions', () => {
    for (const bad of [
      { field: 'status', op: 'is' },
      condition('mystery', 'is', [1]),
      condition('status', 'wat', [1])
    ]) {
      const result = filtered(bad)
      expect(result.issues).toEqual([])
      expect(result.unsupported.length).toBeGreaterThan(0)
    }
  })
  it('returns metadata labels and range start without object coercion', () => {
    expect(planningIssueProperty(a, 'status', metadata)).toBe('Open')
    expect(planningIssueProperty(a, 'assignee', metadata)).toBe('Ada')
    expect(planningIssueProperty(a, 'type', metadata)).toBe('Bug')
    expect(planningIssueProperty(a, 'cf:9', metadata)).toBe('Blue')
    expect(planningIssueDate(a, 'cf:13')).toBe('2025-03-01')
    expect(planningIssueProperty(a, 'cf:13', metadata)).not.toContain('[object Object]')
  })
  it('keeps manual order and stable ties while grouping using metadata', () => {
    const c = issue(3, { priority: 'high', assigneeUserId: 'u' })
    expect(sortPlanningIssues([a, b, c], { field: 'priority', dir: 'asc' }, metadata)).toEqual([
      b,
      a,
      c
    ])
    expect(sortPlanningIssues([a, b], { field: 'priority', dir: 'desc' }, metadata)).toEqual([a, b])
    expect(sortPlanningIssues([a, b], { field: 'manual' }, metadata)).toEqual([a, b])
    expect(
      groupPlanningIssues([a, b], 'assignee', metadata).map(({ label, issues }) => [
        label,
        issues.map((i) => i.id)
      ])
    ).toEqual([
      ['Ada', [1]],
      ['Unassigned', [2]]
    ])
    expect(groupPlanningIssues([a], 'unknown', metadata)).toEqual([])
  })
})
it('sorts status by metadata position and keeps missing dates last with stable ties', () => {
  const first = issue(10, { columnId: 1, dueDate: '2025-01-01' })
  const second = issue(11, { columnId: 2 })
  const tie = issue(12, { columnId: 1, dueDate: '2025-01-01' })
  expect(
    sortPlanningIssues([second, first, tie], { field: 'status', dir: 'asc' }, metadata)
  ).toEqual([first, tie, second])
  expect(
    sortPlanningIssues([second, first, tie], { field: 'dueDate', dir: 'desc' }, metadata)
  ).toEqual([first, tie, second])
})

it('uses real custom values and account-local calendar days', () => {
  const meta: ItsaplanProjectDetails = {
    ...metadata,
    viewer: { timeZone: 'Asia/Nicosia' },
    customFields: [
      { id: 20, name: 'Option', fieldType: 'select', options: [{ id: 4, value: 'Real label' }] },
      { id: 21, name: 'Markdown', fieldType: 'markdown' },
      { id: 22, name: 'URL', fieldType: 'url' },
      { id: 23, name: 'Moment', fieldType: 'datetime' },
      { id: 24, name: 'Range', fieldType: 'datetime_range' }
    ]
  }
  const item = issue(20, {
    createdAt: '2025-01-01T23:30:00Z',
    fieldValues: [
      { fieldId: 20, value: null, optionIds: [4] },
      { fieldId: 21, value: 'Hello Markdown', optionIds: [] },
      { fieldId: 22, value: 'https://example.com', optionIds: [] },
      { fieldId: 23, value: '2025-01-01T23:30:00Z', optionIds: [] },
      {
        fieldId: 24,
        value: '2025-01-01T23:30:00Z',
        valueEnd: '2025-01-04T01:00:00Z',
        optionIds: []
      }
    ]
  })
  expect(planningIssueProperty(item, 'cf:20', meta)).toBe('Real label')
  expect(planningIssueDate(item, 'cf:23', meta)).toBe('2025-01-02')
  expect(planningIssueDate(issue(21, { dueDate: '2025-01-01' }), 'dueDate', meta)).toBe(
    '2025-01-01'
  )
  expect(planningIssueDate(issue(22, { dueDate: 'invalid' }), 'dueDate', meta)).toBeNull()
  expect(planningIssueProperty(item, 'cf:24', meta)).toContain('2025-01-04')
  for (const c of [
    condition('cf:21', 'contains', ['markdown']),
    condition('cf:22', 'contains', ['example']),
    condition('cf:23', 'after', ['2025-01-01']),
    condition('created', 'after', ['2025-01-01'])
  ]) {
    expect(applyPlanningFilters([item], { conditions: [c] }, meta).issues).toEqual([item])
  }
})
