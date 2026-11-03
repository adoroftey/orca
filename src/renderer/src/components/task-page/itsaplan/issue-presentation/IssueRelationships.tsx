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
  display = DEFAULT_DISPLAY,
  compact = false
}: {
  issue: ItsaplanIssueSummary
  metadata: ItsaplanProjectDetails | null
  allIssues?: ItsaplanIssueSummary[]
  onOpenIssue: (id: number) => void
  display?: Record<string, unknown>
  compact?: boolean
}) {
  const [collapsed, setCollapsed] = useState(display.collapseSubtasks === true || compact)
  const [allChildren, setAllChildren] = useState(false)
  const [expandedLinks, setExpandedLinks] = useState<Record<string, boolean>>({})
  const [allLinks, setAllLinks] = useState<Record<string, boolean>>({})
  const children = allIssues.filter((item) => item.id !== issue.id && item.parentId === issue.id)
  const parent =
    issue.parentId !== issue.id ? allIssues.find((item) => item.id === issue.parentId) : undefined
  const progress = issueSubtaskProgress(issue, allIssues, metadata)
  const groups = new Map<string, ReturnType<typeof issueRelations>>()
  for (const link of issueRelations(issue)) {
    groups.set(link.label, [...(groups.get(link.label) ?? []), link])
  }
  const label = (key: string) =>
    key === 'Blocks' || key === 'blocks'
      ? translate('itsaplan.presentation.blocks', 'Blocks')
      : key === 'Blocked by' || key === 'blocked_by'
        ? translate('itsaplan.presentation.blockedBy', 'Blocked by')
        : key === 'Related' || key === 'relates'
          ? translate('itsaplan.presentation.related', 'Related')
          : key === 'Duplicates' || key === 'duplicates'
            ? translate('itsaplan.presentation.duplicates', 'Duplicates')
            : key
  const row = (id: number, target?: ItsaplanIssueSummary) => {
    const column = metadata?.columns.find((item) => item.id === target?.columnId)
    return (
      <div className="flex min-w-0 items-start justify-between gap-2">
        <button
          type="button"
          className="min-w-0 line-clamp-2 text-left hover:underline"
          onClick={() => onOpenIssue(id)}
        >
          {target ? `${target.identifier} ${target.title}` : id}
        </button>
        {target && (
          <IssueStatusBadge
            name={column?.name ?? translate('itsaplan.presentation.unknownStage', 'Unknown stage')}
            color={column?.color}
            stateType={column?.stateType}
          />
        )}
      </div>
    )
  }
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {parent && (
        <div>
          {translate('itsaplan.presentation.parent', 'Parent')}:{' '}
          <button
            type="button"
            className="text-left hover:underline"
            onClick={() => onOpenIssue(parent.id)}
          >
            {parent.identifier}
          </button>
        </div>
      )}
      {display.showSubtasks !== false && children.length > 0 && (
        <div>
          <button
            type="button"
            className="text-left hover:underline"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            {translate('itsaplan.planning.views.subtasks', 'Subtasks')} ({progress.completed}/
            {progress.total}
            {progress.canceled
              ? `, ${progress.canceled} ${translate('itsaplan.presentation.canceled', 'canceled')}`
              : ''}
            )
          </button>
          {!collapsed && (
            <div className="space-y-1">
              <ul className="divide-y divide-border">
                {(allChildren ? children : children.slice(0, 3)).map((child) => (
                  <li key={child.id} className="py-1">
                    {row(child.id, child)}
                  </li>
                ))}
              </ul>
              {children.length > 3 && (
                <button
                  type="button"
                  className="text-left hover:underline"
                  onClick={() => setAllChildren(!allChildren)}
                >
                  {allChildren
                    ? translate('itsaplan.presentation.showFewerSubtasks', 'Show fewer subtasks')
                    : translate('itsaplan.presentation.showAllSubtasks', 'Show all subtasks')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {display.showLinks !== false &&
        [...groups].map(([key, links]) => (
          <div key={key}>
            <button
              type="button"
              className="text-left hover:underline"
              aria-expanded={!!expandedLinks[key]}
              onClick={() => setExpandedLinks((prev) => ({ ...prev, [key]: !prev[key] }))}
            >
              {label(key)} ({links.length})
            </button>
            {expandedLinks[key] && (
              <div className="space-y-1">
                <ul className="divide-y divide-border">
                  {(allLinks[key] ? links : links.slice(0, 3)).map((link) => (
                    <li key={link.key} className="py-1">
                      {row(link.id, allIssues.find((item) => item.id === link.id) ?? link.target)}
                    </li>
                  ))}
                </ul>
                {links.length > 3 && (
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => setAllLinks((prev) => ({ ...prev, [key]: !prev[key] }))}
                  >
                    {allLinks[key]
                      ? translate('itsaplan.presentation.showFewerLinks', 'Show fewer links')
                      : translate('itsaplan.presentation.showAllLinks', 'Show all links')}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
    </div>
  )
}
