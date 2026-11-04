import { useEffect, useRef, useState } from 'react'
import type {
  ItsaplanApi,
  ItsaplanIssue,
  ItsaplanProject,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import type { ItsaplanPlanningApi } from '../../../../../../shared/itsaplan/planning-types'
import { readDashboardWidgets } from './dashboard-model'
import { widgetLabel } from './widget-labels'
import { ItsaplanDashboardWidget } from './DashboardWidget'
type Props = {
  layout: unknown[]
  api: ItsaplanApi
  planning: ItsaplanPlanningApi
  project: ItsaplanProject
  metadata: ItsaplanProjectDetails
  issues: ItsaplanIssue[]
  onOpenIssue: (id: number) => void
}
export function DashboardGrid({ layout, ...props }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setNarrow(entry.contentRect.width < 768)
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className="grid gap-3"
      style={{
        gridAutoRows: narrow ? 'auto' : '40px',
        gridTemplateColumns: narrow ? '1fr' : 'repeat(12, minmax(0, 1fr))'
      }}
    >
      {readDashboardWidgets(layout).map((widget) => (
        <div
          key={`${widget.id}-${widget.sourceIndex}`}
          className="min-h-0 min-w-0 overflow-auto scrollbar-sleek rounded border p-3"
          style={
            narrow
              ? undefined
              : {
                  gridColumn: `${widget.x + 1} / span ${widget.w}`,
                  gridRow: `${widget.y + 1} / span ${widget.h}`
                }
          }
        >
          <h3>{widget.title || widgetLabel(widget.type)}</h3>
          <ItsaplanDashboardWidget widget={widget} {...props} />
        </div>
      ))}
    </div>
  )
}
