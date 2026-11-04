import { createBrowserUuid } from '@/lib/browser-uuid'
import { useEffect, useState } from 'react'
import type {
  ItsaplanPlanningApi,
  PlanningInitiative
} from '../../../../../../shared/itsaplan/planning-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import { EMPTY_ISSUES, isRecord, stableKeys } from './view-guards'
import { planningFieldLabel } from './ViewLabels'
import { choiceKey, filterOptions } from './filter-options'
import type { ItsaplanIssue, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'

type Props = {
  value: Record<string, unknown>
  metadata: ItsaplanProjectDetails
  onChange: (value: Record<string, unknown>) => void
  disabled?: boolean
  issues?: ItsaplanIssue[]
  planning?: ItsaplanPlanningApi
  projectRef?: string
}
const fields = [
  'status',
  'statusType',
  'assignee',
  'delegate',
  'priority',
  'type',
  'initiative',
  'cycle',
  'labels',
  'dueDate',
  'startDate',
  'created',
  'updated'
]
export function PlanningFilterEditor({
  value,
  metadata,
  onChange,
  disabled,
  issues = EMPTY_ISSUES,
  planning,
  projectRef
}: Props) {
  const [initiatives, setInitiatives] = useState<PlanningInitiative[]>([])
  useEffect(() => {
    let active = true
    setInitiatives([])
    if (planning && projectRef) {
      const load = async () => {
        const all: PlanningInitiative[] = []
        for (let page = 1; ; page++) {
          const result = await planning.listInitiatives(projectRef, { page, pageSize: 100 })
          all.push(...result.items)
          if (!result.items.length || all.length >= result.total) {
            break
          }
        }
        if (active) {
          setInitiatives(all)
        }
      }
      void load().catch(() => {
        if (active) {
          setInitiatives([])
        }
      })
    }
    return () => {
      active = false
    }
  }, [planning, projectRef])
  const conditions = Array.isArray(value.conditions) ? value.conditions : []
  const keys = stableKeys(conditions)
  const change = (next: unknown[]) => onChange({ ...value, conditions: next })
  return (
    <div className="space-y-2">
      {value.conditions !== undefined && !Array.isArray(value.conditions) && (
        <p role="alert">
          {translate('itsaplan.planning.views.invalidFilters', 'These filters cannot be edited.')}
        </p>
      )}
      {conditions.map((raw, index) => {
        if (!isRecord(raw)) {
          return (
            <p key={keys[index]} role="alert">
              {translate(
                'itsaplan.planning.views.invalidCondition',
                'This condition cannot be edited.'
              )}
            </p>
          )
        }
        const condition = raw
        const update = (part: Record<string, unknown>) =>
          change(conditions.map((item, i) => (i === index ? { ...condition, ...part } : item)))
        const field = typeof condition.field === 'string' ? condition.field : ''
        const op = typeof condition.op === 'string' ? condition.op : ''
        const values = Array.isArray(condition.values) ? condition.values : []
        const choices = filterOptions(field, metadata, issues, initiatives)
        const custom = metadata.customFields?.find((x) => `cf:${x.id}` === field)
        const rawKind = custom?.fieldType ?? custom?.type
        const kind = typeof rawKind === 'string' ? rawKind : ''
        const date =
          ['dueDate', 'startDate', 'created', 'updated'].includes(field) ||
          ['date', 'datetime', 'datetime_range'].includes(kind ?? '')
        const availableOps = date
          ? ['before', 'after', 'is_set', 'is_not_set']
          : ['text', 'markdown', 'url'].includes(kind ?? '')
            ? ['contains', 'not_contains', 'is_set', 'is_not_set']
            : ['is', 'is_not', 'is_set', 'is_not_set']
        const operatorLabels: Record<string, string> = {
          is: translate('itsaplan.planning.views.is', 'Is'),
          is_not: translate('itsaplan.planning.views.isNot', 'Is not'),
          is_set: translate('itsaplan.planning.views.isSet', 'Is set'),
          is_not_set: translate('itsaplan.planning.views.isNotSet', 'Is not set'),
          before: translate('itsaplan.planning.views.before', 'Before'),
          after: translate('itsaplan.planning.views.after', 'After'),
          contains: translate('itsaplan.planning.views.contains', 'Contains'),
          not_contains: translate('itsaplan.planning.views.notContains', 'Does not contain')
        }
        const fieldsWithCustom = [
          ...fields,
          ...(metadata.customFields ?? []).map((x) => `cf:${x.id}`)
        ]
        return (
          <div
            key={typeof condition.id === 'string' ? condition.id : keys[index]}
            className="flex flex-wrap items-center gap-2"
          >
            <select
              aria-label={translate('itsaplan.planning.views.field', 'Field')}
              disabled={disabled}
              value={field}
              onChange={(e) => update({ field: e.target.value })}
              className="rounded border bg-background p-1"
            >
              {!fieldsWithCustom.includes(field) && <option value={field}>{field || '?'}</option>}
              {fieldsWithCustom.map((f) => (
                <option key={f} value={f}>
                  {planningFieldLabel(f, metadata)}
                </option>
              ))}
            </select>
            <select
              aria-label={translate('itsaplan.planning.views.operator', 'Operator')}
              disabled={disabled}
              value={op}
              onChange={(e) => update({ op: e.target.value })}
              className="rounded border bg-background p-1"
            >
              {!availableOps.includes(op) && (
                <option value={op}>{operatorLabels[op] ?? (op || '?')}</option>
              )}
              {availableOps.map((o) => (
                <option key={o} value={o}>
                  {operatorLabels[o]}
                </option>
              ))}
            </select>
            {op !== 'is_set' &&
              op !== 'is_not_set' &&
              (choices ? (
                <select
                  aria-label={translate('itsaplan.planning.views.value', 'Value')}
                  multiple
                  disabled={disabled}
                  value={values.map((v) => choiceKey(v))}
                  onChange={(e) =>
                    update({
                      values: Array.from(
                        e.target.selectedOptions,
                        (option) =>
                          [...choices, ...values.map((v) => ({ value: v, label: String(v) }))].find(
                            (c) => choiceKey(c.value) === option.value
                          )?.value
                      )
                    })
                  }
                  className="rounded border bg-background p-1"
                >
                  {values
                    .filter((v) => !choices.some((c) => choiceKey(c.value) === choiceKey(v)))
                    .map((v) => (
                      <option key={choiceKey(v)} value={choiceKey(v)}>
                        {String(v)} (
                        {translate('itsaplan.planning.views.unsupportedCondition', 'Unsupported')})
                      </option>
                    ))}
                  {choices.map((c) => (
                    <option key={choiceKey(c.value)} value={choiceKey(c.value)}>
                      {c.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  type={date ? 'date' : kind === 'number' ? 'number' : 'text'}
                  aria-label={translate('itsaplan.planning.views.value', 'Value')}
                  disabled={disabled}
                  value={
                    typeof values[0] === 'string' || typeof values[0] === 'number'
                      ? String(values[0])
                      : ''
                  }
                  onChange={(e) =>
                    update({
                      values: e.target.value
                        ? [kind === 'number' ? Number(e.target.value) : e.target.value]
                        : []
                    })
                  }
                />
              ))}
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => change(conditions.filter((_, i) => i !== index))}
            >
              {translate('itsaplan.planning.views.removeCondition', 'Remove condition')}
            </Button>
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        disabled={disabled || (value.conditions !== undefined && !Array.isArray(value.conditions))}
        onClick={() =>
          change([
            ...conditions,
            { id: createBrowserUuid(), field: 'status', op: 'is', values: [] }
          ])
        }
      >
        {translate('itsaplan.planning.views.addCondition', 'Add condition')}
      </Button>
    </div>
  )
}
