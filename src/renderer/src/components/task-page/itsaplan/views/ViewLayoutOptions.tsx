import { translate } from '@/i18n/i18n'
import type { ItsaplanIssue, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
type Option = { key: string; label: string }
export function savedGroupKey(group: string, key: string): string {
  if (group.startsWith('cf:')) {
    return `f${group.slice(3)}${key ? `u${key}` : '-none'}`
  }
  const prefixes: Record<string, string> = {
    status: 'c',
    assignee: 'a',
    delegate: 'd',
    priority: 'p',
    type: 't',
    initiative: 'i',
    cycle: 'y'
  }
  return (prefixes[group] ?? '') + (key || '-none')
}
export function groupOptions(
  group: string,
  metadata: ItsaplanProjectDetails,
  issues: ItsaplanIssue[] = []
): Option[] {
  let options: Option[] = []
  if (group === 'status') {
    options = metadata.columns.map((c) => ({ key: String(c.id), label: c.name }))
  }
  if (group === 'priority') {
    options = ['urgent', 'high', 'medium', 'low'].map((key) => ({ key, label: key }))
  }
  if (group === 'type') {
    options = (metadata.issueTypes ?? []).map((x) => ({ key: String(x.id), label: x.name }))
  }
  if (group === 'assignee' || group === 'delegate' || group.startsWith('cf:')) {
    const field = metadata.customFields?.find((f) => `cf:${f.id}` === group)
    const scope =
      group === 'assignee' ? 'member' : group === 'delegate' ? 'agent' : field?.memberScope
    if (!group.startsWith('cf:') || field?.fieldType === 'member') {
      options = metadata.assignees
        .filter(
          (a) =>
            !['member', 'members', 'humans', 'agent', 'agents'].includes(String(scope)) ||
            a.kind ===
              (scope === 'members' || scope === 'humans'
                ? 'member'
                : scope === 'agents'
                  ? 'agent'
                  : scope)
        )
        .map((a) => ({ key: a.userId, label: a.name }))
    }
  }
  if (group === 'initiative' || group === 'cycle') {
    for (const issue of issues) {
      const ref = group === 'initiative' ? issue.initiative : issue.cycle
      if (ref && !options.some((o) => o.key === String(ref.id))) {
        options.push({
          key: String(ref.id),
          label: 'title' in ref ? ref.title : (ref.name ?? String(ref.id))
        })
      }
    }
  }
  if (group !== 'none' && group !== 'status') {
    options.push({ key: '', label: translate('itsaplan.planning.views.none', 'None') })
  }
  return options
}
function isCondition(value: unknown): value is { field: string; op?: unknown; values?: unknown } {
  return !!value && typeof value === 'object' && 'field' in value && typeof value.field === 'string'
}
export function groupAllowed(
  group: string,
  key: string,
  metadata: ItsaplanProjectDetails,
  filters?: Record<string, unknown>,
  issues: ItsaplanIssue[] = []
): boolean {
  const conditions = Array.isArray(filters?.conditions)
    ? filters.conditions.filter(isCondition)
    : []
  return conditions.every((condition) => {
    if (condition.field !== group && !(group === 'status' && condition.field === 'statusType')) {
      return true
    }
    const candidate =
      condition.field === 'statusType'
        ? (metadata.columns.find((c) => String(c.id) === key)?.stateType ?? '')
        : key
    const values = Array.isArray(condition.values) ? condition.values : []
    const found = values.some((value) => {
      if (
        typeof value === 'string' &&
        value.startsWith('status:') &&
        (group === 'initiative' || group === 'cycle')
      ) {
        return issues.some((issue) => {
          const ref = group === 'initiative' ? issue.initiative : issue.cycle
          return ref && String(ref.id) === key && ref.status === value.slice(7)
        })
      }
      return value == null ? candidate === '' : String(value) === candidate
    })
    if (condition.op === 'is') {
      return !values.length || found
    }
    if (condition.op === 'is_not') {
      return !found
    }
    if (condition.op === 'is_set') {
      return candidate !== ''
    }
    if (condition.op === 'is_not_set') {
      return candidate === ''
    }
    return true
  })
}
