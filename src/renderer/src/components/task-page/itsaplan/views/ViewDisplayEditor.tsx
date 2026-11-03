import { groupOptions, savedGroupKey } from './ViewLayoutOptions'
import { planningFieldLabel } from './ViewLabels'
import { displayProperties } from './ViewIssueLayout'
import { translate } from '@/i18n/i18n'
import type { ItsaplanIssue, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
const groups = ['none', 'status', 'assignee', 'delegate', 'priority', 'type', 'initiative', 'cycle']
import { EMPTY_ISSUES, isRecord, properties } from './view-guards'
export { unsupported } from './view-guards'
export function ViewDisplayEditor({
  value,
  metadata,
  onChange,
  disabled,
  issues = EMPTY_ISSUES
}: {
  value: Record<string, unknown>
  metadata: ItsaplanProjectDetails
  onChange: (value: Record<string, unknown>) => void
  disabled?: boolean
  issues?: ItsaplanIssue[]
}) {
  const custom = (metadata.customFields ?? []).map((f) => `cf:${f.id}`)
  const update = (key: string, v: unknown) => onChange({ ...value, [key]: v })
  const select = (label: string, key: string, options: string[], fallback: string) => {
    const current = value[key]
    const selectedValue = typeof current === 'string' ? current : fallback
    return (
      <label className="flex flex-col gap-1">
        {label}
        <select
          disabled={disabled}
          className="rounded border bg-background p-1"
          value={selectedValue}
          onChange={(e) => update(key, e.target.value)}
        >
          {!options.includes(selectedValue) && (
            <option value={selectedValue}>{selectedValue}</option>
          )}
          {options.map((x) => (
            <option key={x} value={x}>
              {planningFieldLabel(x, metadata)}
            </option>
          ))}
        </select>
      </label>
    )
  }
  const sort = isRecord(value.sort) ? value.sort : {}
  const selected = displayProperties(value)
  const group = typeof value.group === 'string' ? value.group : 'status'
  const options = groupOptions(group, metadata, issues).map((option) => ({
    ...option,
    key: savedGroupKey(group, option.key)
  }))
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  for (const key of [
    ...strings(value.hiddenGroups),
    ...strings(value.collapsedGroups),
    ...(typeof value.pinnedGroup === 'string' ? [value.pinnedGroup] : [])
  ]) {
    if (!options.some((option) => option.key === key)) {
      options.push({ key, label: key })
    }
  }
  return (
    <div className="space-y-2">
      {select(
        translate('itsaplan.planning.views.layout', 'Layout'),
        'layout',
        ['kanban', 'table', 'timeline', 'calendar'],
        'kanban'
      )}
      {select(
        translate('itsaplan.planning.views.group', 'Group'),
        'group',
        [...groups, ...custom],
        'status'
      )}
      {select(
        translate('itsaplan.planning.views.subgroup', 'Subgroup'),
        'subgroup',
        [...groups, ...custom],
        'none'
      )}
      <label>
        {translate('itsaplan.planning.views.sort', 'Sort')}
        <select
          disabled={disabled}
          className="ml-2 rounded border bg-background p-1"
          value={String(sort.field ?? 'manual')}
          onChange={(e) => update('sort', { ...sort, field: e.target.value })}
        >
          {[
            'manual',
            'title',
            'identifier',
            'status',
            'priority',
            'assignee',
            'type',
            'startDate',
            'dueDate',
            'created',
            'updated'
          ].map((x) => (
            <option key={x} value={x}>
              {planningFieldLabel(x, metadata)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {translate('itsaplan.planning.views.direction', 'Direction')}
        <select
          disabled={disabled}
          className="ml-2 rounded border bg-background p-1"
          value={String(sort.dir ?? 'asc')}
          onChange={(e) => update('sort', { ...sort, dir: e.target.value })}
        >
          <option value="asc">{translate('itsaplan.planning.views.ascending', 'Ascending')}</option>
          <option value="desc">
            {translate('itsaplan.planning.views.descending', 'Descending')}
          </option>
        </select>
      </label>
      {[
        [
          'showEmptyGroups',
          translate('itsaplan.planning.views.showEmptyGroups', 'Show empty groups')
        ],
        ['showLinks', translate('itsaplan.planning.views.showLinks', 'Show links')],
        ['showSubtasks', translate('itsaplan.planning.views.showSubtasks', 'Show subtasks')],
        [
          'separateSubtasks',
          translate('itsaplan.planning.views.separateSubtasks', 'Show subtasks separately')
        ],
        [
          'collapseSubtasks',
          translate('itsaplan.planning.views.collapseSubtasks', 'Collapse subtasks')
        ],
        [
          'timelineCollapseAll',
          translate('itsaplan.planning.views.timelineCollapseAll', 'Collapse timeline groups')
        ]
      ].map(([key, label]) => (
        <label key={key} className="block">
          <input
            type="checkbox"
            disabled={disabled}
            checked={value[key] === true}
            onChange={(event) => update(key, event.target.checked)}
          />{' '}
          {label}
        </label>
      ))}
      {['hiddenGroups', 'collapsedGroups'].map((key) => (
        <fieldset key={key}>
          <legend>
            {key === 'hiddenGroups'
              ? translate('itsaplan.planning.views.hiddenGroups', 'Hidden groups')
              : translate('itsaplan.planning.views.collapsedGroups', 'Collapsed groups')}
          </legend>
          {options.map((option) => (
            <label key={option.key}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={strings(value[key]).includes(option.key)}
                onChange={(event) =>
                  update(
                    key,
                    event.target.checked
                      ? [...strings(value[key]), option.key]
                      : strings(value[key]).filter((item) => item !== option.key)
                  )
                }
              />{' '}
              {option.label}{' '}
            </label>
          ))}
        </fieldset>
      ))}
      <label>
        {translate('itsaplan.planning.views.pinnedGroup', 'Pinned group')}{' '}
        <select
          disabled={disabled}
          value={typeof value.pinnedGroup === 'string' ? value.pinnedGroup : ''}
          onChange={(event) => update('pinnedGroup', event.target.value || null)}
        >
          <option value="">{translate('itsaplan.planning.views.none', 'None')}</option>
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>{translate('itsaplan.planning.views.properties', 'Properties')}</legend>
        <div className="flex flex-wrap gap-2">
          {[...properties, ...custom].map((p) => (
            <label key={p}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.includes(p)}
                onChange={(e) =>
                  update(
                    'properties',
                    e.target.checked ? [...selected, p] : selected.filter((x) => x !== p)
                  )
                }
              />{' '}
              {planningFieldLabel(p, metadata)}
            </label>
          ))}
        </div>
      </fieldset>
      {select(
        translate('itsaplan.planning.views.calendarDate', 'Calendar date'),
        'calendarDateField',
        ['dueDate', 'startDate', ...custom],
        'dueDate'
      )}
      {select(
        translate('itsaplan.planning.views.timelineScale', 'Timeline scale'),
        'timelineScale',
        ['week', 'month', 'quarter'],
        'week'
      )}
      <label>
        {translate('itsaplan.planning.views.weekStart', 'Week starts')}
        <select
          disabled={disabled}
          className="ml-2 rounded border bg-background p-1"
          value={String(value.weekStart ?? 0)}
          onChange={(e) => update('weekStart', Number(e.target.value))}
        >
          <option value="0">{translate('itsaplan.planning.views.sunday', 'Sunday')}</option>
          <option value="1">{translate('itsaplan.planning.views.monday', 'Monday')}</option>
        </select>
      </label>
    </div>
  )
}
