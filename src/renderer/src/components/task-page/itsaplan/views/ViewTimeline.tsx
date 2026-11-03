import { useState } from 'react'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { IssueRelations } from './ViewPresentation'
import { planningFieldLabel } from './ViewLabels'
import { planningIssueDate } from './view-model'
import { displayProperties, property, ViewGroups, type LayoutProps } from './ViewIssueLayout'
const day = 86400000
function TimelineRows(props: LayoutProps) {
  const [now] = useState(() => Date.now())
  const dates = (props.allIssues ?? props.issues)
    .flatMap((i) => [
      planningIssueDate(i, 'startDate', props.metadata),
      planningIssueDate(i, 'dueDate', props.metadata)
    ])
    .filter((x): x is string => !!x)
    .map((x) => Date.parse(`${x.slice(0, 10)}T00:00:00Z`))
    .filter(Number.isFinite)
  const min = dates.length ? Math.min(...dates) : now
  const max = Math.min(dates.length ? Math.max(...dates) : min + 7 * day, min + 3650 * day)
  const scale =
    props.display.timelineScale === 'quarter' ? 2 : props.display.timelineScale === 'month' ? 5 : 12
  const width = Math.max(7, Math.ceil((max - min) / day) + 1) * scale
  const ticks: number[] = []
  const cursor = new Date(min)
  if (props.display.timelineScale === 'month' || props.display.timelineScale === 'quarter') {
    cursor.setUTCDate(1)
    if (props.display.timelineScale === 'quarter') {
      cursor.setUTCMonth(Math.floor(cursor.getUTCMonth() / 3) * 3)
    }
    if (cursor.getTime() < min) {
      cursor.setUTCMonth(cursor.getUTCMonth() + (props.display.timelineScale === 'quarter' ? 3 : 1))
    }
  }
  while (cursor.getTime() <= max && ticks.length < 530) {
    ticks.push(cursor.getTime())
    if (props.display.timelineScale === 'month' || props.display.timelineScale === 'quarter') {
      cursor.setUTCMonth(cursor.getUTCMonth() + (props.display.timelineScale === 'quarter' ? 3 : 1))
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 7)
    }
  }
  const properties = displayProperties(props.display)
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: width + 240 }}>
        <div className="flex text-xs text-muted-foreground">
          <span className="w-60 shrink-0">
            {translate('itsaplan.planning.views.issue', 'Issue')}
          </span>
          <div className="relative h-6" style={{ width }}>
            {ticks.map((tick) => (
              <span
                aria-hidden="true"
                key={tick}
                className="absolute inset-y-0 border-l"
                style={{ left: ((tick - min) / day) * scale }}
              />
            ))}
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute border-l"
                style={{ left: ((tick - min) / day) * scale }}
              >
                {new Date(tick).toLocaleDateString(getIntlLocale(), {
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC'
                })}
              </span>
            ))}
          </div>
        </div>
        {props.issues.map((issue) => {
          const start = planningIssueDate(issue, 'startDate', props.metadata)
          const end = planningIssueDate(issue, 'dueDate', props.metadata)
          const parse = (value: string | null | undefined) =>
            value ? Date.parse(`${value.slice(0, 10)}T00:00:00Z`) : Number.NaN
          const parsedStart = parse(start)
          const parsedEnd = parse(end)
          const startMs = Number.isFinite(parsedStart) ? parsedStart : parsedEnd
          const endMs = Number.isFinite(parsedEnd) ? parsedEnd : startMs
          return (
            <div key={issue.id} className="flex min-h-10 items-center border-t">
              <div className="w-60 shrink-0">
                <button className="hover:underline" onClick={() => props.onOpenIssue(issue.id)}>
                  {issue.identifier} {issue.title}
                </button>
                <IssueRelations
                  issue={issue}
                  allIssues={props.allIssues ?? props.issues}
                  display={props.display}
                  onOpenIssue={props.onOpenIssue}
                />
                {properties.map((p) => (
                  <div key={p} className="text-xs">
                    {planningFieldLabel(p, props.metadata)}: {property(issue, p, props.metadata)}
                  </div>
                ))}
              </div>
              <div className="relative h-6" style={{ width }}>
                {ticks.map((tick) => (
                  <span
                    aria-hidden="true"
                    key={tick}
                    className="absolute inset-y-0 border-l"
                    style={{ left: ((tick - min) / day) * scale }}
                  />
                ))}
                {Number.isFinite(startMs) && Number.isFinite(endMs) ? (
                  <div
                    className="absolute h-5 overflow-hidden rounded bg-primary px-1 text-xs text-primary-foreground"
                    style={{
                      left: Math.min(width, Math.max(0, ((startMs - min) / day) * scale)),
                      width: Math.min(
                        width,
                        Math.max(scale, ((endMs - startMs) / day) * scale + scale)
                      )
                    }}
                    role="img"
                    aria-label={`${start ?? end ?? '—'} – ${end ?? start ?? '—'}`}
                    title={`${start ?? '—'} – ${end ?? '—'}`}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {translate('itsaplan.planning.views.noDate', 'No date')}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
export function ViewTimeline(props: LayoutProps) {
  return (
    <ViewGroups
      {...props}
      render={(issues) => (
        <TimelineRows {...props} allIssues={props.allIssues ?? props.issues} issues={issues} />
      )}
    />
  )
}
