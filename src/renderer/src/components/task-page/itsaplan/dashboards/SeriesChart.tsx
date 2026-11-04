import { translate } from '@/i18n/i18n'
import { date } from './dashboard-dates'
export { date } from './dashboard-dates'
export const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
export const str = (v: unknown) => (typeof v === 'string' ? v : '')
export const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback
export const rows = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter(obj) : []
export function metricLabel(key: string): string {
  switch (key) {
    case 'created':
      return translate('itsaplan.planning.dashboards.metricCreated', 'Created')
    case 'closed':
      return translate('itsaplan.planning.dashboards.metricClosed', 'Closed')
    case 'count':
      return translate('itsaplan.planning.dashboards.metricCount', 'Count')
    case 'scope':
      return translate('itsaplan.planning.dashboards.metricScope', 'Scope')
    case 'started':
      return translate('itsaplan.planning.dashboards.metricStarted', 'Started')
    case 'completed':
      return translate('itsaplan.planning.dashboards.metricCompleted', 'Completed')
    case 'total':
      return translate('itsaplan.planning.dashboards.metricTotal', 'Total')
    case 'success':
      return translate('itsaplan.planning.dashboards.metricSuccess', 'Success')
    case 'failed':
      return translate('itsaplan.planning.dashboards.metricFailed', 'Failed')
    case 'pending':
      return translate('itsaplan.planning.dashboards.metricPending', 'Pending')
    case 'activeWebhooks':
      return translate('itsaplan.planning.dashboards.metricActiveWebhooks', 'Active webhooks')
    case 'disabledWebhooks':
      return translate('itsaplan.planning.dashboards.metricDisabledWebhooks', 'Disabled webhooks')
    default:
      return key
  }
}
export function Series({
  data,
  labels,
  keys
}: {
  data: Record<string, unknown>[]
  labels: string
  keys: string[]
}) {
  if (!data.length) {
    return <p>{translate('itsaplan.planning.dashboards.empty', 'No data available.')}</p>
  }
  const max = Math.max(1, ...data.flatMap((item) => keys.map((key) => num(item[key], 0))))
  return (
    <div>
      <svg
        role="img"
        aria-label={labels}
        viewBox={`0 0 ${Math.max(100, data.length * 24)} 100`}
        className="w-full h-32 text-primary"
      >
        <title>{labels}</title>
        {data.map((item, i) =>
          keys.map((key, j) => {
            const value = num(item[key], 0)
            return (
              <rect
                key={`${str(item.label || item.week || item.date)}-${key}`}
                x={i * 24 + j * (20 / keys.length)}
                y={90 - (value / max) * 80}
                width={Math.max(2, 18 / keys.length)}
                height={(value / max) * 80}
                fill="currentColor"
                opacity={1 - j * 0.25}
              >
                <title>{`${str(item.label || item.week || item.date)} ${metricLabel(key)}: ${value}`}</title>
              </rect>
            )
          })
        )}
      </svg>
      <ul className="text-xs text-muted-foreground">
        {data.map((item) => (
          <li key={str(item.label || item.week || item.date)}>
            {date(item.label || item.week || item.date)}:{' '}
            {keys.map((key) => `${metricLabel(key)} ${num(item[key], 0)}`).join(', ')}
          </li>
        ))}
      </ul>
    </div>
  )
}
export function Heatmap({ data }: { data: Record<string, unknown>[] }) {
  if (!data.length) {
    return <p>{translate('itsaplan.planning.dashboards.empty', 'No data available.')}</p>
  }
  const max = Math.max(1, ...data.map((item) => num(item.count, 0)))
  return (
    <div
      className="flex flex-wrap gap-1"
      role="group"
      aria-label={translate('itsaplan.planning.dashboards.activity', 'Activity')}
    >
      {data.map((item) => (
        <span
          key={str(item.label)}
          data-heatmap-cell
          aria-label={`${str(item.label)}: ${num(item.count, 0)}`}
          title={`${str(item.label)}: ${num(item.count, 0)}`}
          className="inline-block h-5 w-5 rounded-sm bg-primary"
          style={{ opacity: 0.15 + (0.85 * num(item.count, 0)) / max }}
        />
      ))}
      <ul className="w-full text-xs text-muted-foreground">
        {data.map((item) => (
          <li key={str(item.label || item.week || item.date)}>
            {str(item.label)}: {metricLabel('count')} {num(item.count, 0)}
          </li>
        ))}
      </ul>
    </div>
  )
}
export function Burnup({
  data,
  config
}: {
  data: Record<string, unknown>
  config: Record<string, unknown>
}) {
  const days = rows(data.days)
  const keys = ['scope', 'started', 'completed']
  const forecast = obj(data.forecast) ? data.forecast : null
  const projected =
    forecast && config.forecast !== 'none' ? Date.parse(str(forecast.projectedDate)) : Number.NaN
  const optimistic =
    forecast && config.forecast === 'range' ? Date.parse(str(forecast.optimisticDate)) : Number.NaN
  const pessimistic =
    forecast && config.forecast === 'range' ? Date.parse(str(forecast.pessimisticDate)) : Number.NaN
  const lastDate = Date.parse(str(days.at(-1)?.date))
  const firstDate = Date.parse(str(days[0]?.date))
  const lastTime = Math.max(
    Number.isFinite(lastDate) ? lastDate : 0,
    ...[projected, optimistic, pessimistic].filter(Number.isFinite)
  )
  const scaleDate = (value: number) =>
    30 + (260 * (value - firstDate)) / Math.max(1, lastTime - firstDate)
  const x = (i: number) =>
    Number.isFinite(firstDate) && Number.isFinite(lastDate) && lastTime > firstDate
      ? scaleDate(Date.parse(str(days[i].date)))
      : 30 + (i * 260) / Math.max(1, days.length - 1)
  const max = Math.max(
    1,
    ...days.flatMap((item) => keys.map((key) => num(item[key], 0))),
    forecast ? num(forecast.projectedScope, 0) : 0
  )
  const y = (value: number) => 100 - (value / max) * 80
  const canForecast =
    days.length > 0 &&
    Number.isFinite(firstDate) &&
    Number.isFinite(lastDate) &&
    Number.isFinite(projected) &&
    projected > lastDate &&
    typeof forecast?.projectedScope === 'number'

  return (
    <div>
      {days.length ? (
        <>
          <svg
            role="img"
            aria-label={translate('itsaplan.planning.dashboards.widgetBurnup', 'Burnup')}
            viewBox="0 0 320 130"
            className="w-full h-40 text-primary"
          >
            <title>{translate('itsaplan.planning.dashboards.widgetBurnup', 'Burnup')}</title>
            <line x1="30" y1="20" x2="30" y2="100" stroke="currentColor" />
            <line x1="30" y1="100" x2="290" y2="100" stroke="currentColor" />
            <text x="2" y="24" fontSize="8" fill="currentColor">
              {max}
            </text>
            <text x="15" y="100" fontSize="8" fill="currentColor">
              0
            </text>
            {keys.map((key, j) => (
              <polyline
                key={key}
                points={days.map((item, i) => `${x(i)},${y(num(item[key], 0))}`).join(' ')}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={j === 1 ? '5 3' : j === 2 ? '2 2' : undefined}
                opacity={1 - j * 0.2}
              />
            ))}
            {canForecast && (
              <line
                aria-label={translate('itsaplan.planning.dashboards.forecastLine', 'Forecast line')}
                x1={x(days.length - 1)}
                y1={y(num(days.at(-1)?.completed, 0))}
                x2={scaleDate(projected)}
                y2={y(num(forecast?.projectedScope, 0))}
                stroke="currentColor"
                strokeDasharray="4 4"
              />
            )}
            {canForecast &&
              Number.isFinite(optimistic) &&
              Number.isFinite(pessimistic) &&
              optimistic >= lastDate &&
              pessimistic >= optimistic && (
                <polygon
                  aria-label={translate(
                    'itsaplan.planning.dashboards.forecastRange',
                    'Forecast range'
                  )}
                  points={`${x(days.length - 1)},${y(num(days.at(-1)?.completed, 0))} ${scaleDate(optimistic)},${y(num(forecast?.projectedScope, 0))} ${scaleDate(pessimistic)},${y(num(forecast?.projectedScope, 0))}`}
                  fill="currentColor"
                  opacity="0.15"
                />
              )}
            <text x="30" y="118" fontSize="7" fill="currentColor">
              {str(days[0]?.date)}
            </text>
            <text x="230" y="118" fontSize="7" fill="currentColor">
              {Number.isFinite(projected) && projected > lastDate
                ? new Date(lastTime).toISOString().slice(0, 10)
                : str(days.at(-1)?.date)}
            </text>
          </svg>
          <p className="text-xs text-muted-foreground">
            {translate(
              'itsaplan.planning.dashboards.burnupLegend',
              'Scope (solid) · Started (dashed) · Completed (dotted)'
            )}
          </p>
          <ul className="text-xs text-muted-foreground">
            {days.map((item) => (
              <li key={str(item.date)}>
                {date(item.date)}:{' '}
                {keys.map((key) => `${metricLabel(key)} ${num(item[key], 0)}`).join(', ')}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>{translate('itsaplan.planning.dashboards.empty', 'No data available.')}</p>
      )}
      {forecast && config.forecast !== 'none' && (
        <div className="text-xs">
          <p>
            {translate('itsaplan.planning.dashboards.forecast', 'Forecast')}:{' '}
            {date(forecast.projectedDate) || '—'}
          </p>
          {config.forecast === 'range' && (
            <p>
              {translate('itsaplan.planning.dashboards.optimistic', 'Optimistic')}:{' '}
              {date(forecast.optimisticDate) || '—'} ·{' '}
              {translate('itsaplan.planning.dashboards.pessimistic', 'Pessimistic')}:{' '}
              {date(forecast.pessimisticDate) || '—'}
            </p>
          )}
          <p>
            {translate('itsaplan.planning.dashboards.remaining', 'Remaining')}:{' '}
            {num(forecast.remaining, 0)} ·{' '}
            {translate('itsaplan.planning.dashboards.velocity', 'Velocity per day')}:{' '}
            {num(forecast.velocityPerDay, 0)}
          </p>
        </div>
      )}
      {data.targetDate != null && (
        <p>
          {translate('itsaplan.planning.dashboards.target', 'Target')}: {date(data.targetDate)}
        </p>
      )}
    </div>
  )
}
