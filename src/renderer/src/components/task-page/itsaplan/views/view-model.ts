import { getIntlLocale, translate } from '@/i18n/i18n'
import type { ItsaplanIssue, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
import { customId, planningIssueProperty, rawValues } from './view-values'
export { applyPlanningFilters } from './view-filters'
export { planningIssueDate, planningIssueDateRange, planningIssueProperty } from './view-values'

const sortFields = new Set([
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
])
const collator = new Intl.Collator(getIntlLocale(), { numeric: true, sensitivity: 'base' })
const priorityOrder = ['urgent', 'high', 'medium', 'low']
export function sortPlanningIssues(
  issues: ItsaplanIssue[],
  sort: unknown,
  metadata: ItsaplanProjectDetails
): ItsaplanIssue[] {
  if (!sort || typeof sort !== 'object' || Array.isArray(sort)) {
    return [...issues]
  }
  const { field, dir } = Object.fromEntries(Object.entries(sort))
  if (typeof field !== 'string' || !sortFields.has(field)) {
    return [...issues]
  }
  const direction = dir === 'desc' ? -1 : 1
  const value = (issue: ItsaplanIssue): string | number => {
    if (field === 'priority') {
      return priorityOrder.indexOf(issue.priority ?? '') + 1 || 5
    }
    if (field === 'status') {
      const column = metadata.columns.find((item) => item.id === issue.columnId)
      return column?.position ?? metadata.columns.findIndex((item) => item.id === issue.columnId)
    }
    if (field === 'identifier') {
      return issue.sequenceNumber
    }
    if (field === 'assignee' || field === 'type') {
      return planningIssueProperty(issue, field, metadata)
    }
    return String(rawValues(issue, field, metadata)[0] ?? '')
  }
  const missing = (issue: ItsaplanIssue) =>
    ['assignee', 'type', 'startDate', 'dueDate', 'created', 'updated', 'title'].includes(field) &&
    (rawValues(issue, field, metadata)[0] == null || rawValues(issue, field, metadata)[0] === '')
  return issues
    .map((issue, index) => ({ issue, index }))
    .sort((a, b) => {
      const absent = Number(missing(a.issue)) - Number(missing(b.issue))
      if (absent) {
        return absent
      }
      const left = value(a.issue),
        right = value(b.issue)
      const compared =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : collator.compare(String(left), String(right))
      return direction * compared || a.index - b.index
    })
    .map((item) => item.issue)
}
const groupFields = new Set([
  'none',
  'status',
  'assignee',
  'delegate',
  'priority',
  'type',
  'initiative',
  'cycle'
])
export function groupPlanningIssues(
  issues: ItsaplanIssue[],
  field: string,
  metadata: ItsaplanProjectDetails
): { key: string; label: string; issues: ItsaplanIssue[] }[] {
  const custom = customId(field)
  const customField = metadata.customFields?.find((item) => item.id === custom)
  if (
    !groupFields.has(field) &&
    (custom === null || (customField?.fieldType ?? customField?.type) !== 'member')
  ) {
    return []
  }
  if (field === 'none') {
    return [
      {
        key: 'none',
        label: translate('itsaplan.planning.views.allIssues', 'All issues'),
        issues: [...issues]
      }
    ]
  }
  const groups = new Map<string, { key: string; label: string; issues: ItsaplanIssue[] }>()
  for (const issue of issues) {
    const value = rawValues(issue, field, metadata)[0]
    const key = value == null || value === '' ? '' : String(value)
    let group = groups.get(key)
    if (!group) {
      group = { key, label: planningIssueProperty(issue, field, metadata), issues: [] }
      groups.set(key, group)
    }
    group.issues.push(issue)
  }
  return [...groups.values()]
}
