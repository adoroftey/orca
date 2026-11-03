import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanIssueSummary,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import { IssueSummaryCard } from './IssueSummaryCard'
import { isIssueBlocked } from './issue-progress'

export function IssueStatusBoard({
  issues,
  metadata,
  allIssues = issues,
  onOpenIssue,
  compact = false,
  filterable = true,
  renderActions
}: {
  issues: ItsaplanIssueSummary[]
  metadata: ItsaplanProjectDetails | null
  allIssues?: ItsaplanIssueSummary[]
  onOpenIssue: (id: number) => void
  compact?: boolean
  filterable?: boolean
  renderActions?: (issue: ItsaplanIssueSummary) => React.ReactNode
}) {
  const [filterState, setFilterState] = useState({ scope: '', filter: 'all' })
  const [layout, setLayout] = useState<'board' | 'list'>('board')
  const dataset = issues
    .map((issue) => issue.id)
    .sort((a, b) => a - b)
    .join(',')
  const scope = JSON.stringify([metadata?.project.id, metadata?.project.ref, dataset])
  const filter = filterState.scope === scope ? filterState.filter : 'all'
  const setFilter = (nextFilter: string) => setFilterState({ scope, filter: nextFilter })
  const columns = metadata?.columns ?? []
  const blocked = issues.filter((issue) => isIssueBlocked(issue, allIssues, metadata))
  const selected =
    filter === 'all'
      ? issues
      : filter === 'blocked'
        ? blocked
        : issues.filter((issue) => String(issue.columnId) === filter)
  const unknown = selected.filter(
    (issue) => !columns.some((column) => column.id === issue.columnId)
  )
  const unknownCount = issues.filter(
    (issue) => !columns.some((column) => column.id === issue.columnId)
  ).length
  const card = (issue: ItsaplanIssueSummary) => (
    <IssueSummaryCard
      key={issue.id}
      issue={issue}
      metadata={metadata}
      allIssues={allIssues}
      onOpenIssue={onOpenIssue}
      compact={compact}
      actions={renderActions?.(issue)}
    />
  )
  return (
    <div className="space-y-3">
      {filterable && (
        <div
          className="flex flex-wrap items-center gap-1"
          aria-label={translate('itsaplan.presentation.stageFilters', 'Stage filters')}
        >
          <Button
            size="sm"
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            {translate('itsaplan.presentation.all', 'All')} ({issues.length})
          </Button>
          {columns.map((column) => (
            <Button
              key={column.id}
              size="sm"
              variant={filter === String(column.id) ? 'secondary' : 'ghost'}
              aria-pressed={filter === String(column.id)}
              onClick={() => setFilter(String(column.id))}
            >
              {column.name} ({issues.filter((issue) => issue.columnId === column.id).length})
            </Button>
          ))}
          <Button
            size="sm"
            variant={filter === 'blocked' ? 'secondary' : 'ghost'}
            aria-pressed={filter === 'blocked'}
            onClick={() => setFilter('blocked')}
          >
            {translate('itsaplan.presentation.blocked', 'Blocked')} ({blocked.length})
          </Button>
        </div>
      )}
      <div className="flex gap-1">
        <Button
          size="sm"
          variant={layout === 'board' ? 'secondary' : 'ghost'}
          aria-pressed={layout === 'board'}
          onClick={() => setLayout('board')}
        >
          {translate('itsaplan.presentation.board', 'Board')}
        </Button>
        <Button
          size="sm"
          variant={layout === 'list' ? 'secondary' : 'ghost'}
          aria-pressed={layout === 'list'}
          onClick={() => setLayout('list')}
        >
          {translate('itsaplan.presentation.list', 'List')}
        </Button>
      </div>
      {layout === 'list' && selected.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate('itsaplan.presentation.noIssues', 'No issues in this selection.')}
        </p>
      ) : layout === 'list' ? (
        <div className="space-y-2">{selected.map(card)}</div>
      ) : (
        <div className="flex flex-wrap items-start gap-3">
          {selected.length === 0 && (
            <p className="w-full text-sm text-muted-foreground">
              {translate('itsaplan.presentation.noIssues', 'No issues in this selection.')}
            </p>
          )}
          {columns.map((column) => {
            const stageIssues = selected.filter((issue) => issue.columnId === column.id)
            const stageCount = issues.filter((issue) => issue.columnId === column.id).length
            if (stageCount === 0 && filter !== String(column.id)) {
              return null
            }
            return (
              <section
                key={column.id}
                className="min-w-48 flex-1 rounded-md border bg-muted/30 p-2"
              >
                <h3 className="mb-2 text-sm font-medium">
                  {column.name} <span className="text-muted-foreground">{stageCount}</span>
                </h3>
                {stageIssues.length > 0 && <div className="space-y-2">{stageIssues.map(card)}</div>}
              </section>
            )
          })}
          {unknownCount > 0 && (
            <section className="min-w-48 flex-1 rounded-md border bg-muted/30 p-2">
              <h3 className="mb-2 text-sm font-medium">
                {translate('itsaplan.presentation.unknownStage', 'Unknown stage')} {unknownCount}
              </h3>
              <div className="space-y-2">{unknown.map(card)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
