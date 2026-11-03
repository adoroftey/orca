import { EMPTY_ISSUES } from './view-guards'
import { useState } from 'react'
import { translate } from '@/i18n/i18n'
import type { ItsaplanIssue, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
import { IssueSummaryCard } from '../issue-presentation/IssueSummaryCard'
import { planningFieldLabel } from './ViewLabels'
import { groupOptions, savedGroupKey, groupAllowed } from './ViewLayoutOptions'
import { groupPlanningIssues, planningIssueProperty } from './view-model'
export type LayoutProps = {
  issues: ItsaplanIssue[]
  metadata: ItsaplanProjectDetails
  allIssues?: ItsaplanIssue[]
  filters?: Record<string, unknown>
  display: Record<string, unknown>
  onOpenIssue: (id: number) => void
}
export function displayProperties(display: Record<string, unknown>): string[] {
  if (Array.isArray(display.properties)) {
    return display.properties.filter((item): item is string => typeof item === 'string')
  }
  if (display.layout === 'table') {
    return ['priority', 'labels', 'startDate', 'dueDate', 'assignee']
  }
  if (display.layout === 'timeline' || display.layout === 'calendar') {
    return []
  }
  return [
    'id',
    'status',
    'statusAge',
    'priority',
    'type',
    'dueDate',
    'labels',
    'assignee',
    'created',
    'updated'
  ]
}
export function property(
  issue: ItsaplanIssue,
  field: string,
  metadata: ItsaplanProjectDetails
): string {
  if (field === 'id') {
    return issue.identifier
  }
  return planningIssueProperty(issue, field, metadata)
}
export function IssueCard({
  issue,
  metadata,
  display,
  onOpenIssue,
  allIssues = EMPTY_ISSUES
}: LayoutProps & { issue: ItsaplanIssue }) {
  const properties = displayProperties(display)
  return (
    <IssueSummaryCard
      issue={issue}
      metadata={metadata}
      allIssues={allIssues}
      onOpenIssue={onOpenIssue}
      properties={properties}
      propertyLabels={Object.fromEntries(
        properties.map((field) => [field, planningFieldLabel(field, metadata)])
      )}
      propertyValues={Object.fromEntries(
        properties.map((field) => [field, property(issue, field, metadata)])
      )}
      display={{ ...display, showLinks: display.showLinks === true }}
    />
  )
}
export function ViewGroups(
  props: LayoutProps & { render: (issues: ItsaplanIssue[], key: string) => React.ReactNode }
) {
  const group = typeof props.display.group === 'string' ? props.display.group : 'status'
  const subgroup = typeof props.display.subgroup === 'string' ? props.display.subgroup : 'none'
  const hidden = Array.isArray(props.display.hiddenGroups) ? props.display.hiddenGroups : []
  const collapsed = Array.isArray(props.display.collapsedGroups)
    ? props.display.collapsedGroups
    : []
  const matches = (keys: unknown[], key: string) =>
    keys.includes(key) || keys.includes(savedGroupKey(group, key))
  const visibleIssues =
    props.display.separateSubtasks === true
      ? props.issues
      : props.issues.filter(
          (issue) => !issue.parentId || !props.issues.some((parent) => parent.id === issue.parentId)
        )
  const groups = groupPlanningIssues(visibleIssues, group, props.metadata).filter(
    (g) => !matches(hidden, g.key)
  )
  if (props.display.showEmptyGroups !== false) {
    for (const option of groupOptions(group, props.metadata, props.allIssues ?? props.issues)) {
      if (
        !matches(hidden, option.key) &&
        !groups.some((item) => item.key === option.key) &&
        groupAllowed(
          group,
          option.key,
          props.metadata,
          props.filters,
          props.allIssues ?? props.issues
        )
      ) {
        groups.push({ ...option, issues: [] })
      }
    }
  }
  const allowedGroups = groups
  if (group === 'status') {
    const order = props.metadata.columns.map((column) => String(column.id))
    allowedGroups.sort((a, b) => {
      const ai = order.indexOf(a.key)
      const bi = order.indexOf(b.key)
      return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi)
    })
  }
  const pinned = props.display.pinnedGroup
  allowedGroups.sort((a, b) => Number(matches([pinned], b.key)) - Number(matches([pinned], a.key)))
  const isKanban = (props.display.layout ?? 'kanban') === 'kanban'
  return (
    <div className={isKanban ? 'flex flex-wrap items-start gap-3' : 'flex min-w-0 flex-col gap-3'}>
      {allowedGroups.map((g) => (
        <GroupSection
          key={g.key}
          label={g.label}
          isKanban={isKanban}
          count={g.issues.length}
          initialCollapsed={
            matches(collapsed, g.key) ||
            (props.display.layout === 'timeline' && props.display.timelineCollapseAll === true)
          }
        >
          {subgroup === 'none'
            ? props.render(g.issues, g.key)
            : groupPlanningIssues(g.issues, subgroup, props.metadata).map((s) => (
                <div key={s.key}>
                  <h4>{s.label}</h4>
                  {props.render(s.issues, g.key)}
                </div>
              ))}
        </GroupSection>
      ))}
      {allowedGroups.length === 0 && (
        <p>{translate('itsaplan.planning.views.noIssues', 'No issues')}</p>
      )}
    </div>
  )
}

function GroupSection({
  label,
  isKanban,
  count,
  initialCollapsed,
  children
}: {
  label: string
  isKanban: boolean
  count: number
  initialCollapsed: boolean
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  return (
    <section
      className={
        isKanban
          ? 'min-w-48 flex-1 space-y-2 rounded-md border bg-muted/30 p-2'
          : 'min-w-0 w-full space-y-2 rounded-md border bg-muted/30 p-2'
      }
    >
      <h3
        className="font-medium"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed(!collapsed)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            setCollapsed(!collapsed)
          }
        }}
      >
        {label} ({count})
      </h3>
      {!collapsed && children}
    </section>
  )
}
