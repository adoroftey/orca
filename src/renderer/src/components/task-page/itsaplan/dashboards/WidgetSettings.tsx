import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanProject,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import type {
  ItsaplanPlanningApi,
  PlanningInitiative
} from '../../../../../../shared/itsaplan/planning-types'
import { ActivityActionInput } from './WidgetInputs'
import { PlanningFilterEditor } from '../views/FilterEditor'
import type { PlanningWidget } from './dashboard-model'
type Props = {
  widget: PlanningWidget
  metadata: ItsaplanProjectDetails
  planning: ItsaplanPlanningApi
  project: ItsaplanProject
  disabled: boolean
  onChange: (updates: Record<string, unknown>) => void
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
export function WidgetSettings({ widget, metadata, planning, project, disabled, onChange }: Props) {
  const [initiatives, setInitiatives] = useState<PlanningInitiative[]>([])
  const [error, setError] = useState(false)
  useEffect(() => {
    if (widget.type !== 'burnup' || metadata.permissions?.initiatives?.read !== true) {
      return
    }
    let active = true
    const load = async () => {
      let page = 1
      let items: PlanningInitiative[] = []
      while (true) {
        const result = await planning.listInitiatives(project.ref, { page, pageSize: 100 })
        items = [...items, ...result.items]
        if (!result.items.length || items.length >= result.total) {
          break
        }
        page++
      }
      if (active) {
        setInitiatives(items)
      }
    }
    load().catch(() => {
      if (active) {
        setError(true)
      }
    })
    return () => {
      active = false
    }
  }, [widget.type, metadata.permissions?.initiatives?.read, planning, project.ref])
  const update = (key: string, val: unknown) =>
    onChange({ config: { ...widget.config, [key]: val } })
  const number = (
    key: string,
    label: string,
    fallback: number,
    max = key === 'limit' ? 100 : key === 'forecastWeeks' ? 52 : 365
  ) => (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        min="1"
        max={max}
        className="w-20 rounded border bg-background p-1"
        disabled={disabled}
        value={
          typeof widget.config[key] === 'number' && Number.isFinite(widget.config[key])
            ? Math.max(1, Math.min(max, Math.floor(widget.config[key])))
            : fallback
        }
        onChange={(e) => {
          const value = e.target.valueAsNumber
          update(
            key,
            Number.isFinite(value) ? Math.max(1, Math.min(max, Math.floor(value))) : fallback
          )
        }}
      />
    </label>
  )
  const select = (key: string, label: string, choices: string[]) => (
    <label>
      {label}
      <select
        aria-label={label}
        className="rounded border bg-background p-1"
        disabled={disabled}
        value={typeof widget.config[key] === 'string' ? String(widget.config[key]) : choices[0]}
        onChange={(e) => update(key, e.target.value || null)}
      >
        {choices.map((choice) => (
          <option key={choice}>{choice}</option>
        ))}
      </select>
    </label>
  )
  return (
    <div className="space-y-2">
      <label>
        {translate('itsaplan.planning.dashboards.title', 'Title')}
        <Input
          aria-label={translate('itsaplan.planning.dashboards.title', 'Title')}
          value={widget.title ?? ''}
          disabled={disabled}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </label>
      {(widget.type === 'stat' || widget.type === 'recent_issues') && (
        <PlanningFilterEditor
          value={object(widget.config.filters) ? widget.config.filters : {}}
          metadata={metadata}
          disabled={disabled}
          onChange={(v) => update('filters', v)}
        />
      )}
      {widget.type === 'recent_issues' && (
        <>
          {select('sort', translate('itsaplan.planning.dashboards.sort', 'Sort'), [
            'updated',
            'created'
          ])}
          {number('limit', translate('itsaplan.planning.dashboards.limit', 'Limit'), 10)}
        </>
      )}
      {(widget.type === 'activity_feed' || widget.type === 'agent_runs') &&
        number('limit', translate('itsaplan.planning.dashboards.limit', 'Limit'), 20)}
      {widget.type === 'activity_feed' && (
        <>
          <label>
            {translate('itsaplan.planning.dashboards.actor', 'Actor')}
            <select
              aria-label={translate('itsaplan.planning.dashboards.actor', 'Actor')}
              value={typeof widget.config.actorUserId === 'string' ? widget.config.actorUserId : ''}
              disabled={disabled}
              onChange={(e) => update('actorUserId', e.target.value || null)}
            >
              <option value="">{translate('itsaplan.planning.dashboards.all', 'All')}</option>
              {metadata.assignees.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <ActivityActionInput
            value={widget.config.action}
            disabled={disabled}
            onChange={(value) => update('action', value)}
          />
        </>
      )}
      {widget.type === 'pulse' && (
        <>
          {select('pulseScope', translate('itsaplan.planning.dashboards.scope', 'Scope'), [
            'project',
            'me'
          ])}
          {select(
            'granularity',
            translate('itsaplan.planning.dashboards.granularity', 'Granularity'),
            ['day', 'hour', 'week']
          )}
        </>
      )}
      {widget.type === 'throughput' &&
        number('weeks', translate('itsaplan.planning.dashboards.weeks', 'Weeks'), 12)}
      {(widget.type === 'burnup' ||
        widget.type === 'agent_health' ||
        widget.type === 'webhook_health') &&
        number(
          'days',
          translate('itsaplan.planning.dashboards.days', 'Days'),
          widget.type === 'burnup' ? 90 : 30
        )}
      {widget.type === 'burnup' && (
        <>
          {number(
            'forecastWeeks',
            translate('itsaplan.planning.dashboards.forecastWeeks', 'Forecast weeks'),
            4
          )}
          {select(
            'forecast',
            translate('itsaplan.planning.dashboards.forecastStyle', 'Forecast style'),
            ['line', 'range', 'none']
          )}
          {metadata.permissions?.initiatives?.read === true && (
            <label>
              {translate('itsaplan.planning.dashboards.initiative', 'Initiative')}
              <select
                aria-label={translate('itsaplan.planning.dashboards.initiative', 'Initiative')}
                value={
                  typeof widget.config.initiativeId === 'number'
                    ? String(widget.config.initiativeId)
                    : ''
                }
                disabled={disabled}
                onChange={(e) =>
                  update('initiativeId', e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">{translate('itsaplan.planning.dashboards.all', 'All')}</option>
                {initiatives.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && (
            <p role="alert">
              {translate(
                'itsaplan.planning.dashboards.initiativeError',
                'Unable to load initiatives.'
              )}
            </p>
          )}
        </>
      )}
      {widget.type === 'breakdown' &&
        select('by', translate('itsaplan.planning.dashboards.breakdownBy', 'Break down by'), [
          'status',
          'priority',
          'type',
          'assignee',
          'delegate'
        ])}
      {widget.type === 'agent_runs' &&
        select('runStatus', translate('itsaplan.planning.dashboards.runStatus', 'Run status'), [
          '',
          'pending',
          'success',
          'failed'
        ])}
    </div>
  )
}
