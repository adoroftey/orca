import type { ItsaplanIssue, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
export const properties = [
  'id',
  'status',
  'priority',
  'type',
  'assignee',
  'delegate',
  'initiative',
  'cycle',
  'labels',
  'estimatePoints',
  'estimateTime',
  'startDate',
  'dueDate',
  'created',
  'updated',
  'statusAge'
]
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
const groupFields = [
  'none',
  'status',
  'assignee',
  'delegate',
  'priority',
  'type',
  'initiative',
  'cycle'
]
export function unsupported(
  display: Record<string, unknown>,
  metadata: ItsaplanProjectDetails
): string[] {
  const errors: string[] = []
  const known = new Set([
    'layout',
    'sort',
    'group',
    'subgroup',
    'properties',
    'showEmptyGroups',
    'showLinks',
    'showSubtasks',
    'separateSubtasks',
    'collapseSubtasks',
    'timelineScale',
    'timelineCollapseAll',
    'calendarDateField',
    'weekStart',
    'hiddenGroups',
    'collapsedGroups',
    'pinnedGroup'
  ])
  for (const key of Object.keys(display)) {
    if (!known.has(key)) {
      errors.push(key)
    }
  }
  for (const key of [
    'showEmptyGroups',
    'showLinks',
    'showSubtasks',
    'separateSubtasks',
    'collapseSubtasks',
    'timelineCollapseAll'
  ]) {
    if (display[key] !== undefined && typeof display[key] !== 'boolean') {
      errors.push(key)
    }
  }
  const layout = display.layout ?? 'kanban'
  if (!['kanban', 'board', 'table', 'timeline', 'calendar'].includes(String(layout))) {
    errors.push('layout')
  }
  for (const field of ['group', 'subgroup']) {
    const v = display[field]
    if (
      v !== undefined &&
      (typeof v !== 'string' ||
        (!groupFields.includes(v) &&
          !metadata.customFields?.some((f) => `cf:${f.id}` === v && f.fieldType === 'member')))
    ) {
      errors.push(field)
    }
  }
  const sort = display.sort
  if (
    sort !== undefined &&
    (!isRecord(sort) ||
      ![
        'manual',
        'title',
        'identifier',
        'status',
        'priority',
        'assignee',
        'type',
        'startDate',
        'dueDate',
        'created',
        'updated'
      ].includes(String(sort.field)) ||
      !['asc', 'desc'].includes(String(sort.dir)))
  ) {
    errors.push('sort')
  }
  if (
    display.properties !== undefined &&
    (!Array.isArray(display.properties) ||
      display.properties.some(
        (p) =>
          typeof p !== 'string' ||
          (!properties.includes(p) && !metadata.customFields?.some((f) => `cf:${f.id}` === p))
      ))
  ) {
    errors.push('properties')
  }
  if (
    display.calendarDateField !== undefined &&
    (typeof display.calendarDateField !== 'string' ||
      (!['dueDate', 'startDate'].includes(display.calendarDateField) &&
        !metadata.customFields?.some((f) => `cf:${f.id}` === display.calendarDateField)))
  ) {
    errors.push('calendarDateField')
  }
  if (
    display.timelineScale !== undefined &&
    !['week', 'month', 'quarter'].includes(String(display.timelineScale))
  ) {
    errors.push('timelineScale')
  }
  if (display.weekStart !== undefined && display.weekStart !== 0 && display.weekStart !== 1) {
    errors.push('weekStart')
  }
  for (const key of ['hiddenGroups', 'collapsedGroups']) {
    const item = display[key]
    if (item !== undefined && (!Array.isArray(item) || item.some((x) => typeof x !== 'string'))) {
      errors.push(key)
    }
  }
  if (
    display.pinnedGroup !== undefined &&
    display.pinnedGroup !== null &&
    typeof display.pinnedGroup !== 'string'
  ) {
    errors.push('pinnedGroup')
  }
  return errors
}

const identities = new WeakMap<object, number>()
let nextIdentity = 0
export function stableKeys(items: unknown[]): string[] {
  const occurrences = new Map<string, number>()
  return items.map((item) => {
    if (item !== null && typeof item === 'object') {
      let id = identities.get(item)
      if (id === undefined) {
        id = nextIdentity++
        identities.set(item, id)
      }
      return `object:${id}`
    }
    const value = `${typeof item}:${String(item)}`
    const count = occurrences.get(value) ?? 0
    occurrences.set(value, count + 1)
    return `primitive:${value}:${count}`
  })
}

export const EMPTY_ISSUES: ItsaplanIssue[] = []
