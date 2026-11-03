import { translate } from '@/i18n/i18n'
import type { ItsaplanIssue, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
import type { PlanningAnalyticsData } from '../../../../../../shared/itsaplan/planning-types'
import { IssueStatusBoard } from '../issue-presentation/IssueStatusBoard'
import { date, obj, rows, str } from './SeriesChart'

export function DashboardIssueList({
  issues,
  allIssues,
  totalCount,
  metadata,
  onOpenIssue
}: {
  issues: ItsaplanIssue[]
  allIssues?: ItsaplanIssue[]
  totalCount?: number
  metadata: ItsaplanProjectDetails
  onOpenIssue: (id: number) => void
}) {
  return (
    <IssueStatusBoard
      issues={issues}
      metadata={metadata}
      allIssues={allIssues ?? issues}
      totalCount={totalCount}
      onOpenIssue={onOpenIssue}
      compact
    />
  )
}

function activityText(item: Record<string, unknown>): string {
  if (item.action === 'status' && obj(item.payload)) {
    const from = obj(item.payload.from) ? str(item.payload.from.value) : ''
    const to = obj(item.payload.to) ? str(item.payload.to.value) : ''
    if (from && to) {
      return `${translate('itsaplan.presentation.statusChanged', 'Changed status')}: ${from} → ${to}`
    }
  }
  return str(item.body || item.status || item.action)
}

export function DashboardActivity({
  data,
  onOpenIssue,
  timeZone
}: {
  data: PlanningAnalyticsData
  onOpenIssue: (id: number) => void
  timeZone?: string
}) {
  const items = obj(data) ? rows(data.items) : rows(data)
  if (!items.length) {
    return <p>{translate('itsaplan.planning.dashboards.empty', 'No data available.')}</p>
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={String(item.id ?? JSON.stringify(item))} className="border-b border-border pb-2">
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium">
              {str(item.agentName || item.actorName || item.kind || item.trigger)}
            </span>
            <span>{activityText(item)}</span>
            {typeof item.issueId === 'number' && (
              <button
                className="underline"
                onClick={() => {
                  if (typeof item.issueId === 'number') {
                    onOpenIssue(item.issueId)
                  }
                }}
              >
                {str(item.issueIdentifier) || `#${item.issueId}`}
              </button>
            )}
          </div>
          {item.createdAt != null && (
            <time className="block text-xs text-muted-foreground">
              {date(item.createdAt, timeZone)}
            </time>
          )}
          {str(item.lastError) && <p>{str(item.lastError)}</p>}
        </li>
      ))}
    </ul>
  )
}
