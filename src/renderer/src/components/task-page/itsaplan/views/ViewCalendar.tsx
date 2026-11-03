import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { planningIssueDateRange } from './view-model'
import { IssueCard, ViewGroups, type LayoutProps } from './ViewIssueLayout'
const dayMs = 86400000
export function ViewCalendar(props: LayoutProps) {
  const field =
    typeof props.display.calendarDateField === 'string'
      ? props.display.calendarDateField
      : 'dueDate'
  const [month, setMonth] = useState(() => {
    const first = props.issues
      .map((i) => planningIssueDateRange(i, field, props.metadata)[0])
      .find(Boolean)
    const d = first ? new Date(`${first}T00:00:00Z`) : new Date()
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  })
  const weekStart = props.display.weekStart === 1 ? 1 : 0
  const start = month.getTime() - ((month.getUTCDay() - weekStart + 7) % 7) * dayMs
  const days = Array.from({ length: 42 }, (_, i) =>
    new Date(start + i * dayMs).toISOString().slice(0, 10)
  )
  const move = (delta: number) =>
    setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + delta, 1)))
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => move(-1)}>
          {translate('itsaplan.planning.views.previousMonth', 'Previous month')}
        </Button>
        <strong>
          {month.toLocaleDateString(getIntlLocale(), {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC'
          })}
        </strong>
        <Button variant="outline" onClick={() => move(1)}>
          {translate('itsaplan.planning.views.nextMonth', 'Next month')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const now = new Date()
            setMonth(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)))
          }}
        >
          {translate('itsaplan.planning.views.today', 'Today')}
        </Button>
      </div>
      <ViewGroups
        {...props}
        display={{ ...props.display, group: props.display.group ?? 'none' }}
        render={(issues) => (
          <>
            <div className="grid grid-cols-7 gap-1">
              {days.slice(0, 7).map((date) => (
                <div key={date}>
                  {new Date(`${date}T00:00:00Z`).toLocaleDateString(getIntlLocale(), {
                    weekday: 'short',
                    timeZone: 'UTC'
                  })}
                </div>
              ))}
              {days.map((date) => (
                <section key={date} className="min-h-20 overflow-hidden rounded border p-1">
                  <span className="text-xs">{date}</span>
                  {issues
                    .filter((i) => {
                      const [a, b] = planningIssueDateRange(i, field, props.metadata)
                      return a && b && a <= date && date <= b
                    })
                    .map((issue) => (
                      <IssueCard key={issue.id} {...props} issue={issue} />
                    ))}
                </section>
              ))}
            </div>
            {issues.some((i) => !planningIssueDateRange(i, field, props.metadata)[0]) && (
              <section>
                <h3>{translate('itsaplan.planning.views.noDate', 'No date')}</h3>
                {issues
                  .filter((i) => !planningIssueDateRange(i, field, props.metadata)[0])
                  .map((issue) => (
                    <IssueCard key={issue.id} {...props} issue={issue} />
                  ))}
              </section>
            )}
          </>
        )}
      />
    </div>
  )
}
