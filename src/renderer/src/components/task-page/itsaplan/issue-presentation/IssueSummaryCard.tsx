import type { ReactNode } from 'react'
import { translate } from '@/i18n/i18n'
import { formatUiRelativeTimeFromDate } from '@/i18n/relative-time-format'
import { Badge } from '@/components/ui/badge'
import type {
  ItsaplanIssueSummary,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import { ItsaplanDescription } from '../ItsaplanDescription'
import { IssuePropertyValue } from './IssuePropertyValue'
import { IssueRelationships } from './IssueRelationships'

export function IssueSummaryCard({
  issue,
  metadata,
  allIssues,
  onOpenIssue,
  properties,
  propertyValues,
  propertyLabels,
  display,
  compact,
  actions
}: {
  issue: ItsaplanIssueSummary
  metadata: ItsaplanProjectDetails | null
  allIssues?: ItsaplanIssueSummary[]
  onOpenIssue: (id: number) => void
  properties?: string[]
  propertyValues?: Record<string, string>
  propertyLabels?: Record<string, string>
  display?: Record<string, unknown>
  compact?: boolean
  actions?: ReactNode
}) {
  const fields = properties ?? ['status', 'priority', 'type', 'labels', 'assignee', 'delegate']
  const description =
    'description' in issue && typeof issue.description === 'string' ? issue.description : ''
  const updatedAt =
    'updatedAt' in issue && typeof issue.updatedAt === 'string' ? issue.updatedAt : ''
  return (
    <article className="min-w-0 rounded-md border border-border bg-card p-2 text-card-foreground">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="min-w-0 text-left hover:underline"
          onClick={() => onOpenIssue(issue.id)}
        >
          <span className="font-mono text-xs text-muted-foreground">{issue.identifier}</span>{' '}
          <span className="line-clamp-2 text-sm font-medium">{issue.title}</span>
        </button>
        {actions}
      </div>
      {!compact && description && <ItsaplanDescription content={description} preview />}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {(issue.archived === true || !!issue.archivedAt) && (
          <Badge variant="secondary">{translate('itsaplan.issue.archived', 'Archived')}</Badge>
        )}
        {fields
          .filter((field) => !['assignee', 'delegate'].includes(field))
          .map((field) => {
            const value = (
              <IssuePropertyValue
                issue={issue}
                metadata={metadata}
                field={field}
                value={propertyValues?.[field]}
              />
            )
            const label = propertyLabels?.[field]
            return label && !['status', 'priority', 'type', 'labels', 'id'].includes(field) ? (
              <span
                key={field}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs"
              >
                <span className="text-muted-foreground">{label}:</span> {value}
              </span>
            ) : (
              <span key={field}>{value}</span>
            )
          })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {fields
          .filter(
            (field) =>
              ['assignee', 'delegate'].includes(field) &&
              (propertyValues?.[field] ||
                (field === 'assignee' ? issue.assigneeUserId : issue.delegateUserId))
          )
          .map((field) => (
            <span key={field}>
              {field === 'assignee'
                ? translate('itsaplan.presentation.assignee', 'Assignee')
                : translate('itsaplan.presentation.delegate', 'Delegate')}
              :{' '}
              <IssuePropertyValue
                issue={issue}
                metadata={metadata}
                field={field}
                value={propertyValues?.[field]}
              />
            </span>
          ))}
        {properties === undefined && updatedAt && (
          <span>
            {translate('itsaplan.planning.views.updated', 'Updated')}:{' '}
            <time dateTime={updatedAt}>{formatUiRelativeTimeFromDate(updatedAt)}</time>
          </span>
        )}
      </div>
      <IssueRelationships
        issue={issue}
        metadata={metadata}
        allIssues={allIssues}
        onOpenIssue={onOpenIssue}
        display={display}
        compact={compact}
      />
    </article>
  )
}
