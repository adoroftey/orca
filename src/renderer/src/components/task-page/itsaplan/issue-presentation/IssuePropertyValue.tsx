import { Badge } from '@/components/ui/badge'
import { issueStatusColor } from './issue-status-color'
import { IssueStatusBadge } from './IssueStatusBadge'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanIssueSummary,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'

export function IssuePropertyValue({
  issue,
  metadata,
  field,
  value
}: {
  issue: ItsaplanIssueSummary
  metadata: ItsaplanProjectDetails | null
  field: string
  value?: string
}) {
  const member = metadata?.assignees.find(
    (item) => item.userId === (field === 'assignee' ? issue.assigneeUserId : issue.delegateUserId)
  )
  if (field === 'assignee' || field === 'delegate') {
    return (
      <span>
        {member ? (
          <>
            {member.name}
            {member.kind === 'agent' && <> · {translate('itsaplan.presentation.agent', 'Agent')}</>}
          </>
        ) : (
          value || '—'
        )}
      </span>
    )
  }
  if (field === 'status') {
    const column = metadata?.columns.find((item) => item.id === issue.columnId)
    return column ? (
      <IssueStatusBadge name={column.name} color={column.color} stateType={column.stateType} />
    ) : (
      <IssueStatusBadge name={value || '—'} />
    )
  }
  const values =
    field === 'type'
      ? [metadata?.issueTypes?.find((item) => item.id === issue.typeId)]
      : field === 'labels'
        ? issue.labelIds?.map((id) => metadata?.labels?.find((item) => item.id === id))
        : undefined
  if (values) {
    const items = values.filter((item): item is NonNullable<typeof item> => !!item)
    return items.length ? (
      <span className="inline-flex flex-wrap gap-1">
        {items.map((item) => (
          <Badge key={item.id} variant="outline">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: issueStatusColor(item.color) }}
            />
            {item.name}
          </Badge>
        ))}
      </span>
    ) : (
      <span>{value || '—'}</span>
    )
  }
  if (field === 'priority' && issue.priority) {
    return <Badge variant="secondary">{issue.priority}</Badge>
  }
  return <span>{value || '—'}</span>
}
