import { translate } from '@/i18n/i18n'
import type { PlanningAnalyticsData } from '../../../../../../shared/itsaplan/planning-types'
import { obj, str, num, rows, date, Series, Heatmap, Burnup, metricLabel } from './SeriesChart'
export function Content({
  type,
  data,
  open,
  config,
  timeZone
}: {
  type: string
  data: PlanningAnalyticsData
  open: (id: number) => void
  config: Record<string, unknown>
  timeZone?: string
}) {
  if (type === 'pulse') {
    return <Heatmap data={rows(data)} />
  }
  if (type === 'throughput') {
    return (
      <Series
        data={rows(data)}
        labels={translate('itsaplan.planning.dashboards.widgetThroughput', 'Throughput')}
        keys={['created', 'closed']}
      />
    )
  }
  if (type === 'breakdown') {
    return (
      <Series
        data={rows(data)}
        labels={translate('itsaplan.planning.dashboards.widgetBreakdown', 'Breakdown')}
        keys={['count']}
      />
    )
  }
  if (type === 'burnup' && obj(data)) {
    return <Burnup data={data} config={config} />
  }
  if ((type === 'agent_health' || type === 'webhook_health') && obj(data)) {
    return (
      <dl>
        {[
          'total',
          'success',
          'failed',
          'pending',
          ...(type === 'webhook_health' ? ['activeWebhooks', 'disabledWebhooks'] : [])
        ].map((key) => (
          <div key={key}>
            <dt className="inline">{metricLabel(key)}: </dt>
            <dd className="inline">{num(data[key], 0)}</dd>
          </div>
        ))}
      </dl>
    )
  }
  const items = type === 'activity_feed' && obj(data) ? rows(data.items) : rows(data)
  if (!items.length) {
    return <p>{translate('itsaplan.planning.dashboards.empty', 'No data available.')}</p>
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={String(item.id ?? item.agentId ?? JSON.stringify(item))}>
          <span>
            {str(item.agentName || item.actorName || item.kind || item.trigger)}{' '}
            {str(item.body || item.status)}
          </span>
          {typeof item.issueId === 'number' && (
            <button
              className="ml-1 underline"
              onClick={() => {
                if (typeof item.issueId === 'number') {
                  open(item.issueId)
                }
              }}
            >
              {str(item.issueIdentifier) || `#${item.issueId}`}
            </button>
          )}
          {type === 'agent_workload' && (
            <span>
              {' '}
              · {translate('itsaplan.planning.dashboards.open', 'Open')}:{' '}
              {num(item.delegatedOpen, 0)} ·{' '}
              {translate('itsaplan.planning.dashboards.runs', 'Runs')}: {num(item.runsTotal, 0)} ·{' '}
              {translate('itsaplan.planning.dashboards.success', 'Success')}:{' '}
              {num(item.runsSuccess, 0)} ·{' '}
              {translate('itsaplan.planning.dashboards.failed', 'Failed')}:{' '}
              {num(item.runsFailed, 0)}
            </span>
          )}
          {item.createdAt != null && <time> {date(item.createdAt, timeZone)}</time>}
          {str(item.lastError) && <p>{str(item.lastError)}</p>}
        </li>
      ))}
    </ul>
  )
}
