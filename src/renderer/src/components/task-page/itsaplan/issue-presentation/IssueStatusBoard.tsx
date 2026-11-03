import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanIssueSummary,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import { IssueStatusMark } from './IssueStatusMark'
import { issueStatusColor } from './issue-status-color'
import { IssueSummaryCard } from './IssueSummaryCard'
import { IssueExecutionStages } from './IssueExecutionStages'
import { IssueExecutionMatrix } from './IssueExecutionMatrix'
import {
  buildExecutionRows,
  executionStages,
  executionMatrixMinWidth,
  issueExecutionStageKey
} from './execution-board-model'
import { useExecutionBoardWidth } from './use-execution-board-width'
import { isIssueBlocked } from './issue-progress'

export function IssueStatusBoard({
  issues,
  metadata,
  allIssues = issues,
  onOpenIssue,
  compact = false,
  filterable = true,
  renderActions,
  totalCount,
  expandMatches = false
}: {
  issues: ItsaplanIssueSummary[]
  metadata: ItsaplanProjectDetails | null
  allIssues?: ItsaplanIssueSummary[]
  onOpenIssue: (id: number) => void
  compact?: boolean
  filterable?: boolean
  renderActions?: (issue: ItsaplanIssueSummary) => React.ReactNode
  totalCount?: number
  expandMatches?: boolean
}) {
  const [filterState, setFilterState] = useState({ scope: '', filter: 'all' })
  const [onlyWithIssues, setOnlyWithIssues] = useState(true)
  const [layout, setLayout] = useState<'auto' | 'stages' | 'matrix' | 'list'>('auto')
  const { ref, width } = useExecutionBoardWidth()
  const dataset = issues
    .map((issue) => issue.id)
    .sort((a, b) => a - b)
    .join(',')
  const scope = JSON.stringify([metadata?.project.id, metadata?.project.ref, dataset])
  const filter = filterState.scope === scope ? filterState.filter : 'all'
  const setFilter = (nextFilter: string) => setFilterState({ scope, filter: nextFilter })
  const blocked = issues.filter((issue) => isIssueBlocked(issue, allIssues, metadata))
  const selected =
    filter === 'all'
      ? issues
      : filter === 'blocked'
        ? blocked
        : issues.filter((issue) => issueExecutionStageKey(issue, metadata) === filter)
  const stages = executionStages(issues, metadata)
  const visibleStages = onlyWithIssues
    ? stages.filter((stage) => stage.count > 0 || stage.key === filter)
    : stages
  const fits = width >= 1180 && width >= executionMatrixMinWidth(visibleStages)
  const actualLayout = compact
    ? layout === 'list'
      ? 'list'
      : 'stages'
    : layout === 'auto'
      ? fits
        ? 'matrix'
        : 'stages'
      : layout === 'matrix' && !fits
        ? 'stages'
        : layout
  const card = (issue: ItsaplanIssueSummary) => (
    <IssueSummaryCard
      key={issue.id}
      issue={issue}
      metadata={metadata}
      allIssues={allIssues}
      onOpenIssue={onOpenIssue}
      compact={compact}
      display={{ showSubtasks: false }}
      actions={renderActions?.(issue)}
    />
  )
  return (
    <div
      ref={ref}
      className="@container min-w-0 space-y-3"
      role={compact ? 'group' : 'region'}
      aria-label={translate('itsaplan.presentation.board', 'Board')}
    >
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
          {stages.map((stage) => (
            <Button
              key={stage.key}
              size="sm"
              variant={filter === stage.key ? 'secondary' : 'ghost'}
              className="border"
              style={{ borderColor: issueStatusColor(stage.color) }}
              aria-pressed={filter === stage.key}
              onClick={() => setFilter(stage.key)}
            >
              <IssueStatusMark color={stage.color} stateType={stage.stateType} />
              {stage.name} ({stage.count})
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
      <p className="text-xs text-muted-foreground">
        {translate('itsaplan.execution.selection', 'Selected')}: {selected.length} ·{' '}
        {translate('itsaplan.execution.loaded', 'Loaded')}: {issues.length}
        {totalCount !== undefined && (
          <>
            {' '}
            · {translate('itsaplan.execution.total', 'Total matching')}: {totalCount}
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-1">
        {(!compact
          ? (['auto', 'stages', 'matrix', 'list'] as const)
          : (['stages', 'list'] as const)
        ).map((mode) => (
          <Button
            key={mode}
            size="sm"
            variant={(compact ? actualLayout : layout) === mode ? 'secondary' : 'ghost'}
            aria-pressed={(compact ? actualLayout : layout) === mode}
            disabled={mode === 'matrix' && !fits}
            onClick={() => setLayout(mode)}
          >
            {mode === 'auto'
              ? translate('itsaplan.execution.auto', 'Auto')
              : mode === 'stages'
                ? translate('itsaplan.execution.stages', 'Stages')
                : mode === 'matrix'
                  ? translate('itsaplan.execution.matrix', 'Matrix')
                  : translate('itsaplan.presentation.list', 'List')}
          </Button>
        ))}
      </div>
      {actualLayout !== 'list' && (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={onlyWithIssues}
            onCheckedChange={(checked) => setOnlyWithIssues(checked === true)}
          />
          {translate('itsaplan.execution.onlyStatusesWithIssues', 'Only statuses with issues')}
        </label>
      )}
      {selected.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {translate('itsaplan.presentation.noIssues', 'No issues in this selection.')}
        </p>
      )}
      {actualLayout === 'list' ? (
        <div className="space-y-2">{selected.map(card)}</div>
      ) : actualLayout === 'matrix' ? (
        <IssueExecutionMatrix
          rows={buildExecutionRows(selected, allIssues, metadata)}
          stages={visibleStages}
          metadata={metadata}
          allIssues={allIssues}
          onOpenIssue={onOpenIssue}
          renderActions={renderActions}
        />
      ) : (
        <IssueExecutionStages
          key={JSON.stringify([scope, filter, expandMatches])}
          issues={selected}
          stages={visibleStages}
          metadata={metadata}
          allIssues={allIssues}
          onOpenIssue={onOpenIssue}
          renderActions={renderActions}
          compact={compact}
          selectedStage={filter !== 'all' && filter !== 'blocked' ? filter : undefined}
          expandMatches={expandMatches || filter === 'blocked'}
        />
      )}
    </div>
  )
}
