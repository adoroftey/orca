import { useEffect, useRef, useState } from 'react'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanApi,
  ItsaplanIssue,
  ItsaplanProject,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import type {
  ItsaplanPlanningApi,
  PlanningAnalyticsData
} from '../../../../../../shared/itsaplan/planning-types'
import { applyPlanningFilters } from '../views/view-model'
import type { PlanningWidget } from './dashboard-model'
import { Content } from './OperationalWidget'
import { obj, rows } from './SeriesChart'
import { DashboardIssueList, DashboardActivity } from './DashboardIssueList'
import { invalidWidgetConfig, request, widgetLimit } from './widget-query'

type Props = {
  widget: PlanningWidget
  api: ItsaplanApi
  planning: ItsaplanPlanningApi
  project: ItsaplanProject
  metadata: ItsaplanProjectDetails
  issues: ItsaplanIssue[]
  onOpenIssue: (id: number) => void
}
export function ItsaplanDashboardWidget({
  widget,
  planning,
  project,
  metadata,
  issues,
  onOpenIssue
}: Props) {
  const [state, setState] = useState<{
    data?: PlanningAnalyticsData
    error?: boolean
    loading?: boolean
  }>({})
  const [retry, setRetry] = useState(0)
  const [page, setPage] = useState({ loading: false, error: false })
  const generation = useRef(0)
  const configKey = JSON.stringify(widget.config)
  useEffect(() => {
    const parsed: unknown = JSON.parse(configKey)
    const spec = request(widget.type, obj(parsed) ? parsed : {})
    if (!spec) {
      return
    }
    let active = true
    const generationRef = generation
    generationRef.current++
    setPage({ loading: false, error: false })
    setState({ loading: true })
    planning
      .analytics(project.ref, spec.kind, spec.query)
      .then((data) => {
        if (active) {
          setState({ data })
        }
      })
      .catch(() => {
        if (active) {
          setState({ error: true })
        }
      })
    return () => {
      active = false
      generationRef.current++
    }
  }, [planning, project.ref, widget.id, widget.type, configKey, retry])
  const loadMore = () => {
    if (page.loading || !obj(state.data) || !obj(state.data.nextCursor)) {
      return
    }
    const cursor = state.data.nextCursor
    if (typeof cursor.ts !== 'string' || typeof cursor.id !== 'number') {
      return
    }
    const spec = request(widget.type, widget.config)
    if (!spec || spec.kind !== 'activity') {
      return
    }
    const current = generation.current
    setPage({ loading: true, error: false })
    planning
      .analytics(project.ref, 'activity', {
        ...spec.query,
        cursor: { ts: cursor.ts, id: cursor.id }
      })
      .then((next) => {
        if (current !== generation.current || !obj(next)) {
          return
        }
        setState((previous) => {
          if (!obj(previous.data)) {
            return previous
          }
          const existing = rows(previous.data.items)
          const seen = new Set(existing.map((item) => item.id))
          const added = rows(next.items).filter((item) => {
            if (seen.has(item.id)) {
              return false
            }
            seen.add(item.id)
            return true
          })
          return {
            data: { ...previous.data, items: [...existing, ...added], nextCursor: next.nextCursor }
          }
        })
        setPage({ loading: false, error: false })
      })
      .catch(() => {
        if (current === generation.current) {
          setPage({ loading: false, error: true })
        }
      })
  }
  if (invalidWidgetConfig(widget.type, widget.config)) {
    return (
      <p>
        {translate(
          'itsaplan.planning.dashboards.invalidConfig',
          'Invalid configuration. Open widget settings to correct it.'
        )}
      </p>
    )
  }
  if (widget.type === 'stat' || widget.type === 'recent_issues') {
    const filtered = applyPlanningFilters(
      issues,
      obj(widget.config.filters) ? widget.config.filters : {},
      metadata
    )
    if (filtered.unsupported.length) {
      return (
        <p>
          {translate('itsaplan.planning.dashboards.unsupportedFilter', 'Unsupported filter')}:{' '}
          {filtered.unsupported.join(', ')}
        </p>
      )
    }
    if (widget.type === 'stat') {
      return <strong>{filtered.issues.length}</strong>
    }
    const field = widget.config.sort === 'created' ? 'createdAt' : 'updatedAt'
    const sorted = [...filtered.issues]
      .sort((a, b) => b[field].localeCompare(a[field]))
      .slice(0, widgetLimit(widget.config, 10))
    return sorted.length ? (
      <DashboardIssueList
        issues={sorted}
        allIssues={issues}
        totalCount={filtered.issues.length}
        metadata={metadata}
        onOpenIssue={onOpenIssue}
      />
    ) : (
      <p>{translate('itsaplan.planning.dashboards.empty', 'No data available.')}</p>
    )
  }
  if (!request(widget.type, widget.config)) {
    return (
      <p>
        {translate('itsaplan.planning.dashboards.unsupportedWidget', 'Unsupported widget type')}:{' '}
        {widget.type || '—'}
      </p>
    )
  }
  if (state.error) {
    return (
      <p>
        {translate('itsaplan.planning.dashboards.widgetLoadError', 'Unable to load widget.')}{' '}
        <button className="underline" onClick={() => setRetry((n) => n + 1)}>
          {translate('itsaplan.planning.dashboards.retry', 'Retry')}
        </button>
      </p>
    )
  }
  if (!state.data || state.loading) {
    return <p>{translate('itsaplan.planning.dashboards.loading', 'Loading…')}</p>
  }
  return (
    <>
      {widget.type === 'activity_feed' ? (
        <DashboardActivity
          data={state.data}
          onOpenIssue={onOpenIssue}
          timeZone={metadata.viewer?.timeZone}
        />
      ) : (
        <Content
          type={widget.type}
          data={state.data}
          open={onOpenIssue}
          config={widget.config}
          timeZone={metadata.viewer?.timeZone}
        />
      )}
      {widget.type === 'activity_feed' && obj(state.data) && obj(state.data.nextCursor) && (
        <div>
          {page.error && (
            <p>
              {translate('itsaplan.planning.dashboards.widgetLoadError', 'Unable to load widget.')}
            </p>
          )}
          <button className="underline" disabled={page.loading} onClick={loadMore}>
            {page.loading
              ? translate('itsaplan.planning.dashboards.loading', 'Loading…')
              : page.error
                ? translate('itsaplan.planning.dashboards.retry', 'Retry')
                : translate('itsaplan.planning.dashboards.loadMore', 'Load more')}
          </button>
        </div>
      )}
    </>
  )
}
