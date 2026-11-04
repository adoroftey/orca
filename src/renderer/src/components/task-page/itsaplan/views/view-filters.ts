import type { ItsaplanIssue, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
import { calendarDay, customId, planningIssueDate, rawValues } from './view-values'
const fields = new Set([
  'status',
  'statusType',
  'assignee',
  'delegate',
  'priority',
  'type',
  'initiative',
  'cycle',
  'labels',
  'dueDate',
  'startDate',
  'created',
  'updated'
])
const ops = new Set([
  'is',
  'is_not',
  'is_set',
  'is_not_set',
  'before',
  'after',
  'contains',
  'not_contains'
])
type Scalar = string | number | boolean | null
type Condition = { field: string; op: string; values: Scalar[] }
const missing = (value: unknown) => value == null || value === ''
function matches(
  issue: ItsaplanIssue,
  condition: Condition,
  metadata: ItsaplanProjectDetails
): boolean {
  const { field, op, values } = condition
  const actual = rawValues(issue, field, metadata)
  const overlap = actual.some((a) => values.some((v) => (v === null ? missing(a) : a === v)))
  if (op === 'is') {
    return overlap
  }
  if (op === 'is_not') {
    return !overlap
  }
  if (op === 'is_set') {
    return actual.some((value) => !missing(value))
  }
  if (op === 'is_not_set') {
    return actual.every(missing)
  }
  if (op === 'contains' || op === 'not_contains') {
    const found = actual.some(
      (a) =>
        typeof a === 'string' &&
        values.some((v) => typeof v === 'string' && a.toLowerCase().includes(v.toLowerCase()))
    )
    return op === 'contains' ? found : !found
  }
  const date = planningIssueDate(issue, field, metadata)
  return (
    date !== null &&
    values.some((v) => {
      const comparison = calendarDay(v, metadata)
      return comparison !== null && (op === 'before' ? date < comparison : date > comparison)
    })
  )
}
function isEffectiveFilter(value: unknown): boolean {
  if (value == null || value === false || value === '') {
    return false
  }
  if (Array.isArray(value)) {
    return value.length > 0
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0
  }
  return true
}
export function applyPlanningFilters(
  issues: ItsaplanIssue[],
  filters: Record<string, unknown>,
  metadata: ItsaplanProjectDetails
): { issues: ItsaplanIssue[]; unsupported: string[] } {
  const unknown = Object.entries(filters)
    .filter(([key, value]) => key !== 'conditions' && isEffectiveFilter(value))
    .map(([key]) => key)
  if (unknown.length) {
    return { issues: [], unsupported: unknown }
  }
  const source = filters.conditions
  if (source === undefined) {
    return { issues: [...issues], unsupported: [] }
  }
  if (!Array.isArray(source)) {
    return { issues: [], unsupported: ['Malformed conditions'] }
  }
  const conditions: Condition[] = []
  const unsupported: string[] = []
  source.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      unsupported.push(`Condition ${index + 1}`)
      return
    }
    const c = Object.fromEntries(Object.entries(item))
    if (
      (c.id !== undefined && typeof c.id !== 'string') ||
      typeof c.field !== 'string' ||
      typeof c.op !== 'string' ||
      !Array.isArray(c.values) ||
      c.values.some((v) => v !== null && !['string', 'number', 'boolean'].includes(typeof v))
    ) {
      unsupported.push(`Condition ${index + 1}`)
      return
    }
    if (c.values.length === 0 && c.op !== 'is_set' && c.op !== 'is_not_set') {
      return
    }
    if ((!fields.has(c.field) && customId(c.field) === null) || !ops.has(c.op)) {
      unsupported.push(`${c.field}:${c.op}`)
      return
    }
    const custom = customId(c.field)
    const customField = metadata.customFields?.find((field) => field.id === custom)
    const rawFieldType = customField?.fieldType ?? customField?.type
    const fieldType = typeof rawFieldType === 'string' ? rawFieldType : ''
    if (
      custom !== null &&
      (!customField ||
        ![
          'text',
          'markdown',
          'url',
          'number',
          'boolean',
          'date',
          'datetime',
          'datetime_range',
          'select',
          'multi_select',
          'member'
        ].includes(fieldType ?? ''))
    ) {
      unsupported.push(`${c.field}:${c.op}`)
      return
    }
    if (
      custom !== null &&
      ['is', 'is_not'].includes(c.op) &&
      !['number', 'boolean', 'select', 'multi_select', 'member'].includes(fieldType ?? '')
    ) {
      unsupported.push(`${c.field}:${c.op}`)
      return
    }
    const textOperator = c.op === 'contains' || c.op === 'not_contains'
    const dateOperator = c.op === 'before' || c.op === 'after'
    if (
      (textOperator &&
        (custom === null || !['text', 'markdown', 'url'].includes(fieldType ?? ''))) ||
      (dateOperator &&
        !['startDate', 'dueDate', 'created', 'updated'].includes(c.field) &&
        (custom === null || !['date', 'datetime', 'datetime_range'].includes(fieldType ?? '')))
    ) {
      unsupported.push(`${c.field}:${c.op}`)
      return
    }
    const values: Scalar[] = c.values.filter(
      (value): value is Scalar =>
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    )
    conditions.push({ field: c.field, op: c.op, values })
  })
  return unsupported.length
    ? { issues: [], unsupported }
    : {
        issues: issues.filter((issue) =>
          conditions.every((condition) => matches(issue, condition, metadata))
        ),
        unsupported
      }
}
