import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanIssueSummary,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import { IssueStatusBadge } from './IssueStatusBadge'
import { issueRelations, issueSubtaskProgress } from './issue-progress'

const EMPTY_ISSUES: ItsaplanIssueSummary[] = []
const DEFAULT_DISPLAY: Record<string, unknown> = {}

export function IssueRelationships({
  issue,
  metadata,
  allIssues = EMPTY_ISSUES,
  onOpenIssue,
  display = DEFAULT_DISPLAY
}: {
  issue: ItsaplanIssueSummary
  metadata: ItsaplanProjectDetails | null
  allIssues?: ItsaplanIssueSummary[]
  onOpenIssue: (id: number) => void
  display?: Record<string, unknown>
}) {
  const [collapsed, setCollapsed] = useState(display.collapseSubtasks === true)
  const children = allIssues.filter((item) => item.id !== issue.id && item.parentId === issue.id)
  const parent =
    issue.parentId !== issue.id ? allIssues.find((item) => item.id === issue.parentId) : undefined
  const progress = issueSubtaskProgress(issue, allIssues, metadata)
  const status = (item: ItsaplanIssueSummary | undefined) =>
    metadata?.columns.find((column) => column.id === item?.columnId)
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {parent && (
        <div>
          {translate('itsaplan.presentation.parent', 'Parent')}:{' '}
          <button type="button" className="hover:underline" onClick={() => onOpenIssue(parent.id)}>
            {parent.identifier} {parent.title}
          </button>
        </div>
      )}
      {display.showSubtasks !== false && children.length > 0 && (
        <div>
          <button type="button" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '+' : '−'} {translate('itsaplan.planning.views.subtasks', 'Subtasks')} (
            {progress.completed}/{progress.total}
            {progress.canceled
              ? `, ${progress.canceled} ${translate('itsaplan.presentation.canceled', 'canceled')}`
              : ''}
            )
          </button>
          {!collapsed &&
            children.map((child) => (
              <div key={child.id} className="pl-3">
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => onOpenIssue(child.id)}
                >
                  {child.identifier} {child.title}
                </button>
                {status(child) && (
                  <>
                    {' '}
                    ·{' '}
                    <IssueStatusBadge
                      name={status(child)!.name}
                      color={status(child)!.color}
                      stateType={status(child)!.stateType}
                    />
                  </>
                )}
              </div>
            ))}
        </div>
      )}
      {display.showLinks !== false &&
        issueRelations(issue).map((link) => {
          const target = allIssues.find((item) => item.id === link.id) ?? link.target
          const label =
            link.label === 'Blocks'
              ? translate('itsaplan.presentation.blocks', 'Blocks')
              : link.label === 'Blocked by'
                ? translate('itsaplan.presentation.blockedBy', 'Blocked by')
                : link.label === 'Related'
                  ? translate('itsaplan.presentation.related', 'Related')
                  : link.label === 'Duplicates'
                    ? translate('itsaplan.presentation.duplicates', 'Duplicates')
                    : link.label
          return (
            <div key={link.key}>
              <button
                type="button"
                className="hover:underline"
                onClick={() => onOpenIssue(link.id)}
              >
                {label} {target ? `${target.identifier} ${target.title}` : link.id}
              </button>
              {status(target) && (
                <>
                  {' '}
                  ·{' '}
                  <IssueStatusBadge
                    name={status(target)!.name}
                    color={status(target)!.color}
                    stateType={status(target)!.stateType}
                  />
                </>
              )}
            </div>
          )
        })}
    </div>
  )
}
