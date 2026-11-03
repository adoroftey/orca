import type { PlanningInitiative } from '../../../../../../shared/itsaplan/planning-types'
import { translate } from '@/i18n/i18n'
import type { ItsaplanIssue, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
type Scalar = string | number | boolean | null
export type Choice = { value: Scalar; label: string }
export const choiceKey = (value: unknown) => JSON.stringify(value)
export function filterOptions(
  field: string,
  metadata: ItsaplanProjectDetails,
  issues: ItsaplanIssue[],
  initiatives: PlanningInitiative[] = []
): Choice[] | null {
  const custom = metadata.customFields?.find((x) => `cf:${x.id}` === field)
  const kind = custom?.fieldType ?? custom?.type
  const none: Choice = { value: null, label: translate('itsaplan.planning.views.none', 'None') }
  let choices: Choice[] | null = null
  if (field === 'status') {
    choices = metadata.columns.map((x) => ({ value: x.id, label: x.name }))
  } else if (field === 'type') {
    choices = (metadata.issueTypes ?? []).map((x) => ({ value: x.id, label: x.name }))
  } else if (field === 'labels') {
    choices = (metadata.labels ?? []).map((x) => ({ value: x.id, label: x.name }))
  } else if (field === 'assignee' || field === 'delegate' || kind === 'member') {
    const scope =
      field === 'assignee' ? 'humans' : field === 'delegate' ? 'agents' : custom?.memberScope
    choices = metadata.assignees
      .filter((x) =>
        scope === 'humans' ? x.kind === 'member' : scope === 'agents' ? x.kind === 'agent' : true
      )
      .map((x) => ({ value: x.userId, label: x.name }))
  } else if (field === 'priority') {
    choices = [
      { value: 'urgent', label: translate('itsaplan.planning.views.priorityUrgent', 'Urgent') },
      { value: 'high', label: translate('itsaplan.planning.views.priorityHigh', 'High') },
      { value: 'medium', label: translate('itsaplan.planning.views.priorityMedium', 'Medium') },
      { value: 'low', label: translate('itsaplan.planning.views.priorityLow', 'Low') }
    ]
  } else if (field === 'statusType') {
    choices = [...new Set(metadata.columns.map((x) => x.stateType))].map((value) => ({
      value,
      label: value.replace(/[_-]/g, ' ')
    }))
  } else if (field === 'initiative' || field === 'cycle') {
    const items = issues
      .map((x) =>
        field === 'initiative'
          ? x.initiative && {
              id: x.initiative.id,
              name: x.initiative.title,
              status: x.initiative.status
            }
          : x.cycle && { id: x.cycle.id, name: x.cycle.name, status: x.cycle.status }
      )
      .filter((x) => x != null)
    if (field === 'initiative') {
      items.push(...initiatives.map((x) => ({ id: x.id, name: x.title, status: x.status })))
    }
    choices = Array.from(
      new Map(items.map((x) => [x.id, { value: x.id, label: x.name ?? String(x.id) }])).values()
    )
    choices.push(
      ...[...new Set(items.map((x) => x.status))].map((status) => ({
        value: `status:${status}`,
        label: `${translate('itsaplan.planning.views.fieldStatus', 'Status')}: ${status.replace(/[_-]/g, ' ')}`
      }))
    )
  } else if (kind === 'boolean' || kind === 'checkbox') {
    choices = [
      { value: true, label: translate('itsaplan.planning.views.yes', 'Yes') },
      { value: false, label: translate('itsaplan.planning.views.no', 'No') }
    ]
  } else if (custom && Array.isArray(custom.options)) {
    choices = custom.options.flatMap((item): Choice[] => {
      if (!item || typeof item !== 'object') {
        return []
      }
      const option = Object.fromEntries(Object.entries(item))
      return typeof option.id === 'number'
        ? [
            {
              value: option.id,
              label: String(option.value ?? option.name ?? option.label ?? option.id)
            }
          ]
        : []
    })
  }
  return choices ? [none, ...choices] : null
}
