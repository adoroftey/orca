import { translate } from '@/i18n/i18n'
import { formatUiNarrowDuration, formatUiRelativeTime } from '@/i18n/relative-time-format'
import type { ItsaplanIssue, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
type Details = ItsaplanProjectDetails
export const customId = (field: string): number | null =>
  /^cf:\d+$/.test(field) ? Number(field.slice(3)) : null
export function rawValues(issue: ItsaplanIssue, field: string, metadata: Details): unknown[] {
  const custom = customId(field)
  if (custom !== null) {
    const entry = issue.fieldValues?.find((value) => value.fieldId === custom)
    if (!entry) {
      return [null]
    }
    return entry.optionIds?.length
      ? entry.optionIds
      : Array.isArray(entry.value)
        ? entry.value
        : [entry.value ?? null]
  }
  switch (field) {
    case 'status':
      return [issue.columnId]
    case 'statusType':
      return [metadata.columns.find((column) => column.id === issue.columnId)?.stateType ?? null]
    case 'assignee':
      return [issue.assigneeUserId]
    case 'delegate':
      return [issue.delegateUserId ?? null]
    case 'priority':
      return [issue.priority]
    case 'type':
      return [issue.typeId ?? null]
    case 'initiative':
      return [
        issue.initiativeId ?? issue.initiative?.id ?? null,
        ...(issue.initiative?.status ? [`status:${issue.initiative.status}`] : [])
      ]
    case 'cycle':
      return [
        issue.cycleId ?? issue.cycle?.id ?? null,
        ...(issue.cycle?.status ? [`status:${issue.cycle.status}`] : [])
      ]
    case 'labels':
      return issue.labelIds?.length ? issue.labelIds : [null]
    case 'startDate':
      return [issue.startDate ?? null]
    case 'dueDate':
      return [issue.dueDate ?? null]
    case 'created':
      return [issue.createdAt]
    case 'updated':
      return [issue.updatedAt]
    case 'estimatePoints':
      return [issue.estimatePoints ?? null]
    case 'estimateTime':
      return [issue.estimateMinutes ?? null]
    case 'statusAge':
      return [issue.statusSince ?? null]
    case 'title':
      return [issue.title]
    case 'identifier':
      return [issue.identifier]
    default:
      return [null]
  }
}
const absent = (value: unknown) => value === null || value === undefined || value === ''
export function calendarDay(value: unknown, metadata?: Details): string | null {
  if (typeof value !== 'string' || !value) {
    return null
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const time = Date.parse(`${value}T00:00:00Z`)
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
      ? value
      : null
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return null
  }
  const time = Date.parse(value)
  if (!Number.isFinite(time)) {
    return null
  }
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: metadata?.viewer?.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(time)
    const part = (type: string) => parts.find((item) => item.type === type)?.value
    return `${part('year')}-${part('month')}-${part('day')}`
  } catch {
    return null
  }
}
export function planningIssueDateRange(
  issue: ItsaplanIssue,
  field: string,
  metadata?: Details
): [string | null, string | null] {
  const entry =
    customId(field) !== null
      ? issue.fieldValues?.find((v) => v.fieldId === customId(field))
      : undefined
  const value: unknown =
    entry?.value ??
    (field === 'startDate'
      ? issue.startDate
      : field === 'dueDate'
        ? issue.dueDate
        : field === 'created'
          ? issue.createdAt
          : field === 'updated'
            ? issue.updatedAt
            : null)
  const legacy =
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value))
      : null
  const start = calendarDay(legacy ? legacy.start : value, metadata)
  const end = calendarDay(legacy ? legacy.end : entry?.valueEnd, metadata)
  return [start ?? end, end ?? start]
}
export function planningIssueDate(
  issue: ItsaplanIssue,
  field: string,
  metadata?: Details
): string | null {
  return planningIssueDateRange(issue, field, metadata)[0]
}
export function planningIssueProperty(
  issue: ItsaplanIssue,
  field: string,
  metadata: Details
): string {
  if (field === 'statusAge') {
    const timestamp = issue.statusSince ? Date.parse(issue.statusSince) : Number.NaN
    return Number.isFinite(timestamp)
      ? formatUiRelativeTime(timestamp - Date.now())
      : translate('itsaplan.planning.views.none', 'None')
  }
  if (
    field === 'estimateTime' &&
    issue.estimateMinutes != null &&
    Number.isFinite(issue.estimateMinutes)
  ) {
    const hours = Math.floor(issue.estimateMinutes / 60)
    const minutes = issue.estimateMinutes % 60
    return [
      hours ? formatUiNarrowDuration(hours, 'hour') : '',
      minutes || !hours ? formatUiNarrowDuration(minutes, 'minute') : ''
    ]
      .filter(Boolean)
      .join(' ')
  }
  if (field === 'initiative' && issue.initiative?.title) {
    return issue.initiative.title
  }
  if (field === 'cycle' && issue.cycle?.name) {
    return issue.cycle.name
  }
  const values =
    field === 'initiative'
      ? [issue.initiativeId ?? issue.initiative?.id ?? null]
      : field === 'cycle'
        ? [issue.cycleId ?? issue.cycle?.id ?? null]
        : rawValues(issue, field, metadata)
  const custom = customId(field)
  const fieldMeta = metadata.customFields?.find((item) => item.id === custom)
  const options: unknown[] = Array.isArray(fieldMeta?.options) ? fieldMeta.options : []
  const label = (value: unknown): string => {
    if (absent(value)) {
      return field === 'assignee' || field === 'delegate'
        ? translate('itsaplan.assignee.none', 'Unassigned')
        : translate('itsaplan.planning.views.none', 'None')
    }
    if (field === 'status') {
      return metadata.columns.find((item) => item.id === value)?.name ?? String(value)
    }
    if (
      field === 'assignee' ||
      field === 'delegate' ||
      (custom !== null && (fieldMeta?.fieldType ?? fieldMeta?.type) === 'member')
    ) {
      return metadata.assignees.find((item) => item.userId === value)?.name ?? String(value)
    }
    if (field === 'type') {
      return metadata.issueTypes?.find((item) => item.id === value)?.name ?? String(value)
    }
    if (field === 'labels') {
      return metadata.labels?.find((item) => item.id === value)?.name ?? String(value)
    }
    if (field === 'initiative') {
      return issue.initiative?.title ?? String(value)
    }
    if (field === 'cycle') {
      return issue.cycle?.name ?? String(value)
    }
    if (custom !== null) {
      const option = options.find(
        (item) => item !== null && typeof item === 'object' && 'id' in item && item.id === value
      )
      if (option && typeof option === 'object') {
        const entries = Object.fromEntries(Object.entries(option))
        return String(entries.value ?? entries.name ?? entries.label ?? value)
      }
    }
    if (typeof value === 'object') {
      const range = Object.fromEntries(Object.entries(value))
      return (
        [range.start, range.end].filter((v) => typeof v === 'string' && v).join(' – ') ||
        translate('itsaplan.planning.views.none', 'None')
      )
    }
    return String(value)
  }
  if ((fieldMeta?.fieldType ?? fieldMeta?.type) === 'datetime_range') {
    const entry = issue.fieldValues?.find((item) => item.fieldId === custom)
    if (entry?.valueEnd) {
      return [entry.value, entry.valueEnd].filter(Boolean).join(' – ')
    }
  }
  return values.map(label).join(', ')
}
