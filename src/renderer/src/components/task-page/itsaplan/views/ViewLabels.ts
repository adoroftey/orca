import { translate } from '@/i18n/i18n'
import type { ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'

export function planningFieldLabel(field: string, metadata: ItsaplanProjectDetails): string {
  const labels: Record<string, string> = {
    status: translate('itsaplan.planning.views.fieldStatus', 'Status'),
    statusType: translate('itsaplan.planning.views.fieldStatusType', 'Status type'),
    assignee: translate('itsaplan.planning.views.fieldAssignee', 'Assignee'),
    delegate: translate('itsaplan.planning.views.fieldDelegate', 'Delegate'),
    priority: translate('itsaplan.planning.views.fieldPriority', 'Priority'),
    type: translate('itsaplan.planning.views.fieldType', 'Type'),
    initiative: translate('itsaplan.planning.views.fieldInitiative', 'Initiative'),
    cycle: translate('itsaplan.planning.views.fieldCycle', 'Cycle'),
    labels: translate('itsaplan.planning.views.fieldLabels', 'Labels'),
    dueDate: translate('itsaplan.planning.views.fieldDueDate', 'Due date'),
    startDate: translate('itsaplan.planning.views.fieldStartDate', 'Start date'),
    created: translate('itsaplan.planning.views.fieldCreated', 'Created'),
    updated: translate('itsaplan.planning.views.fieldUpdated', 'Updated')
  }
  return (
    labels[field] ?? metadata.customFields?.find((item) => `cf:${item.id}` === field)?.name ?? field
  )
}
