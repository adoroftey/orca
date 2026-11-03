import type { ReactNode } from 'react'
import { translate } from '@/i18n/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type {
  ItsaplanIssueSummary,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import { IssuePropertyValue } from './IssuePropertyValue'
import { IssueSummaryCard } from './IssueSummaryCard'
import {
  EXECUTION_ROW_HEADER_WIDTH,
  EXECUTION_STAGE_MIN_WIDTH,
  issueExecutionStageKey,
  type ExecutionRow,
  type ExecutionStage
} from './execution-board-model'

export function IssueExecutionMatrix({
  rows,
  stages,
  metadata,
  allIssues,
  onOpenIssue,
  renderActions
}: {
  rows: ExecutionRow[]
  stages: ExecutionStage[]
  metadata: ItsaplanProjectDetails | null
  allIssues: ItsaplanIssueSummary[]
  onOpenIssue: (id: number) => void
  renderActions?: (issue: ItsaplanIssueSummary) => ReactNode
}) {
  const columns = `${EXECUTION_ROW_HEADER_WIDTH}px repeat(${stages.length}, minmax(${EXECUTION_STAGE_MIN_WIDTH}px, 1fr))`
  return (
    <div className="rounded-md border border-border" role="table">
      <div
        className="grid border-b border-border"
        style={{ gridTemplateColumns: columns }}
        role="row"
      >
        <div className="p-3 text-xs text-muted-foreground" role="columnheader">
          {translate('itsaplan.execution.group', 'Group')}
        </div>
        {stages.map((stage) => (
          <div
            key={stage.key}
            className="border-l border-border p-3 text-sm font-medium"
            role="columnheader"
          >
            {stage.name} <span className="text-muted-foreground">{stage.count}</span>
          </div>
        ))}
      </div>
      {rows.map((row) => (
        <div
          key={row.key}
          className="grid border-b border-border last:border-b-0"
          style={{ gridTemplateColumns: columns }}
          role="row"
        >
          <div className="min-w-0 space-y-2 p-3" role="rowheader">
            {row.parent ? (
              <>
                <Button
                  variant="link"
                  className="h-auto max-w-full whitespace-normal text-left"
                  onClick={() => onOpenIssue(row.parent!.id)}
                >
                  {row.parent.identifier} {row.parent.title}
                </Button>
                {!row.parentInResults && (
                  <Badge variant="secondary">
                    {translate('itsaplan.execution.context', 'Context')}
                  </Badge>
                )}
                <IssuePropertyValue issue={row.parent} metadata={metadata} field="status" />
                <div className="text-xs text-muted-foreground">
                  {translate('itsaplan.execution.allChildren', 'Loaded children')}:{' '}
                  {row.completedChildren}/{row.totalChildren} ·{' '}
                  {translate('itsaplan.execution.canceled', 'Canceled')}: {row.canceledChildren}
                </div>
                <Progress
                  value={row.totalChildren ? (row.completedChildren / row.totalChildren) * 100 : 0}
                />
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                {translate('itsaplan.execution.ungrouped', 'Ungrouped')}
              </span>
            )}
          </div>
          {stages.map((stage) => (
            <div
              key={stage.key}
              className="min-w-0 space-y-2 border-l border-border p-2"
              role="cell"
            >
              {row.issues
                .filter((issue) => issueExecutionStageKey(issue, metadata) === stage.key)
                .map((issue) =>
                  issue.id === row.parentId ? (
                    <div key={issue.id} className="flex min-w-0 items-start justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-auto max-w-full whitespace-normal text-left"
                        onClick={() => onOpenIssue(issue.id)}
                      >
                        {issue.identifier} {issue.title}
                      </Button>
                      {renderActions?.(issue)}
                    </div>
                  ) : (
                    <IssueSummaryCard
                      key={issue.id}
                      issue={issue}
                      metadata={metadata}
                      allIssues={allIssues}
                      onOpenIssue={onOpenIssue}
                      display={{ showSubtasks: false }}
                      actions={renderActions?.(issue)}
                    />
                  )
                )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
