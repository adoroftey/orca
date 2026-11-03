import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanIssueSummary,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import {
  buildExecutionRows,
  issueExecutionStageKey,
  type ExecutionStage
} from './execution-board-model'
import { IssueSummaryCard } from './IssueSummaryCard'

export function IssueExecutionStages({
  issues,
  stages,
  metadata,
  allIssues,
  onOpenIssue,
  renderActions,
  compact,
  selectedStage,
  expandMatches
}: {
  issues: ItsaplanIssueSummary[]
  stages: ExecutionStage[]
  metadata: ItsaplanProjectDetails | null
  allIssues: ItsaplanIssueSummary[]
  onOpenIssue: (id: number) => void
  renderActions?: (issue: ItsaplanIssueSummary) => React.ReactNode
  compact?: boolean
  selectedStage?: string
  expandMatches?: boolean
}) {
  const populated = stages.filter((stage) => stage.count > 0 || stage.key === selectedStage)
  const hasActive = populated.some(
    (stage) =>
      stage.count > 0 &&
      !['backlog', 'unstarted', 'completed', 'canceled'].includes(stage.stateType)
  )
  const firstWaiting =
    !hasActive &&
    populated.find((stage) => stage.count > 0 && ['backlog', 'unstarted'].includes(stage.stateType))
      ?.key
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const renderStage = (stage: ExecutionStage) => {
    const matches = issues.filter((issue) => issueExecutionStageKey(issue, metadata) === stage.key)
    const defaultOpen =
      !['backlog', 'unstarted', 'completed', 'canceled'].includes(stage.stateType) ||
      stage.key === firstWaiting ||
      stage.key === selectedStage ||
      (!!expandMatches && matches.length > 0)
    const open = overrides[stage.key] ?? defaultOpen
    const rows = buildExecutionRows(matches, allIssues, metadata)
    return (
      <section key={stage.key} className="min-w-0 rounded-md border bg-muted/30 p-2">
        <h3>
          <button
            type="button"
            className="w-full text-left text-sm font-medium"
            aria-expanded={open}
            onClick={() => setOverrides((prev) => ({ ...prev, [stage.key]: !open }))}
          >
            {stage.name} <span className="text-muted-foreground">{stage.count}</span>
          </button>
        </h3>
        {open && (
          <div className="mt-2 space-y-3">
            {rows.map((row) => (
              <div key={row.key} className="space-y-2">
                {row.parent && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <button
                      type="button"
                      className="text-left font-medium hover:underline"
                      onClick={() => onOpenIssue(row.parent!.id)}
                    >
                      {row.parent.identifier} {row.parent.title}
                    </button>
                    <span className="text-muted-foreground">
                      {metadata?.columns.find((column) => column.id === row.parent?.columnId)
                        ?.name ?? translate('itsaplan.presentation.unknownStage', 'Unknown stage')}
                    </span>
                    {!issues.some((issue) => issue.id === row.parent?.id) && (
                      <Badge variant="secondary">
                        {translate('itsaplan.execution.context', 'Context')}
                      </Badge>
                    )}
                    <span className="text-muted-foreground">
                      {translate('itsaplan.execution.allChildren', 'Loaded children')}:{' '}
                      {row.completedChildren}/{row.totalChildren} ·{' '}
                      {translate('itsaplan.execution.canceled', 'Canceled')}: {row.canceledChildren}
                    </span>
                  </div>
                )}
                {row.issues.map((issue) =>
                  issue.id === row.parent?.id ? (
                    <div key={issue.id} className="flex min-w-0 items-start justify-between gap-2">
                      <button
                        type="button"
                        className="min-w-0 text-left text-sm hover:underline"
                        onClick={() => onOpenIssue(issue.id)}
                      >
                        {issue.identifier} {issue.title}
                      </button>
                      {renderActions?.(issue)}
                    </div>
                  ) : (
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
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    )
  }
  const waiting = populated.filter((stage) => ['backlog', 'unstarted'].includes(stage.stateType))
  const terminal = populated.filter((stage) => ['completed', 'canceled'].includes(stage.stateType))
  const active = populated.filter(
    (stage) => !['backlog', 'unstarted', 'completed', 'canceled'].includes(stage.stateType)
  )
  return (
    <div className="space-y-2">
      {waiting.length > 0 && (
        <div className="grid min-w-0 gap-2 @4xl:grid-cols-2">{waiting.map(renderStage)}</div>
      )}
      {active.length > 0 && (
        <div className="grid min-w-0 gap-2 @4xl:grid-cols-2">{active.map(renderStage)}</div>
      )}
      {terminal.length > 0 && (
        <div className="grid min-w-0 gap-2 @4xl:grid-cols-2">{terminal.map(renderStage)}</div>
      )}
    </div>
  )
}
