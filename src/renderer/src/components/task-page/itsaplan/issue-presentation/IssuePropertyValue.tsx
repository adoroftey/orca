import { Badge } from '@/components/ui/badge'
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
  const values =
    field === 'status'
      ? [metadata?.columns.find((item) => item.id === issue.columnId)?.name]
      : field === 'type'
        ? [metadata?.issueTypes?.find((item) => item.id === issue.typeId)?.name]
        : field === 'priority'
          ? [issue.priority]
          : field === 'labels'
            ? issue.labelIds
                ?.map((id) => metadata?.labels?.find((item) => item.id === id)?.name)
                .filter(Boolean)
            : undefined
  if (values) {
    const labels = values.filter((item): item is string => !!item)
    return labels.length ? (
      <span className="inline-flex flex-wrap gap-1">
        {labels.map((label) => (
          <Badge key={label} variant="secondary">
            {label}
          </Badge>
        ))}
      </span>
    ) : (
      <span>{value || '—'}</span>
    )
  }
  return <span>{value || '—'}</span>
}
