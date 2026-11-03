import { translate } from '@/i18n/i18n'
export function ActivityActionInput({
  value,
  disabled,
  onChange
}: {
  value: unknown
  disabled: boolean
  onChange: (value: string | null) => void
}) {
  return (
    <label>
      {translate('itsaplan.planning.dashboards.action', 'Action')}
      <select
        aria-label={translate('itsaplan.planning.dashboards.action', 'Action')}
        disabled={disabled}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{translate('itsaplan.planning.dashboards.all', 'All')}</option>
        {[
          ['created', translate('itsaplan.planning.dashboards.actionCreated', 'Created')],
          ['status', translate('itsaplan.planning.dashboards.actionStatus', 'Status changed')],
          [
            'assignee',
            translate('itsaplan.planning.dashboards.actionAssignee', 'Assignee changed')
          ],
          [
            'priority',
            translate('itsaplan.planning.dashboards.actionPriority', 'Priority changed')
          ],
          ['type', translate('itsaplan.planning.dashboards.actionType', 'Type changed')],
          ['title', translate('itsaplan.planning.dashboards.actionTitle', 'Title changed')],
          [
            'description',
            translate('itsaplan.planning.dashboards.actionDescription', 'Description changed')
          ],
          [
            'start_date',
            translate('itsaplan.planning.dashboards.actionStartDate', 'Start date changed')
          ],
          ['due_date', translate('itsaplan.planning.dashboards.actionDueDate', 'Due date changed')],
          ['label_add', translate('itsaplan.planning.dashboards.actionLabelAdd', 'Label added')],
          [
            'label_remove',
            translate('itsaplan.planning.dashboards.actionLabelRemove', 'Label removed')
          ],
          ['field', translate('itsaplan.planning.dashboards.actionField', 'Field changed')]
        ].map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
        {typeof value === 'string' &&
          value &&
          ![
            'created',
            'status',
            'assignee',
            'priority',
            'type',
            'title',
            'description',
            'start_date',
            'due_date',
            'label_add',
            'label_remove',
            'field'
          ].includes(value) && <option value={value}>{value}</option>}
      </select>
    </label>
  )
}
