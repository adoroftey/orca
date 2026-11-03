import { useRef, useState } from 'react'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanProject,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import type {
  ItsaplanPlanningApi,
  PlanningDashboard
} from '../../../../../../shared/itsaplan/planning-types'
import { KNOWN_WIDGET_TYPES, readDashboardWidgets, replaceDashboardWidget } from './dashboard-model'
import { widgetLabel } from './widget-labels'
import { WidgetSettings } from './WidgetSettings'
type Props = {
  value: PlanningDashboard
  metadata: ItsaplanProjectDetails
  planning: ItsaplanPlanningApi
  project: ItsaplanProject
  disabled: boolean
  onChange: (value: PlanningDashboard) => void
}
export function DashboardEditor({ value, metadata, planning, project, disabled, onChange }: Props) {
  const [type, setType] = useState<string>('stat')
  const drag = useRef<{
    index: number
    startX: number
    startY: number
    x: number
    y: number
    w: number
    h: number
    cell: number
    resize: boolean
  } | null>(null)
  const change = (index: number, updates: Record<string, unknown>) =>
    onChange({ ...value, layout: replaceDashboardWidget(value.layout, index, updates) })
  return (
    <div className="space-y-3">
      <p>{translate('itsaplan.planning.dashboards.unsaved', 'Unsaved changes')}</p>
      <label>
        {translate('itsaplan.planning.dashboards.name', 'Name')}
        <Input
          aria-label={translate('itsaplan.planning.dashboards.name', 'Name')}
          value={value.name}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </label>
      {readDashboardWidgets(value.layout).map((widget) => {
        const editable =
          value.layout[widget.sourceIndex] !== null &&
          typeof value.layout[widget.sourceIndex] === 'object' &&
          !Array.isArray(value.layout[widget.sourceIndex])
        return (
          <section
            key={`${widget.id}-${widget.sourceIndex}`}
            className="space-y-2 rounded border p-3"
          >
            <h3>
              {widget.title ||
                widgetLabel(widget.type) ||
                translate(
                  'itsaplan.planning.dashboards.unsupportedWidget',
                  'Unsupported widget type'
                )}
            </h3>
            {editable && (
              <>
                <button
                  type="button"
                  disabled={disabled}
                  className="cursor-move rounded border p-1"
                  onPointerDown={(e) => {
                    const width = e.currentTarget.parentElement?.parentElement?.clientWidth || 600
                    drag.current = {
                      index: widget.sourceIndex,
                      startX: e.clientX,
                      startY: e.clientY,
                      x: widget.x,
                      y: widget.y,
                      w: widget.w,
                      h: widget.h,
                      cell: width / 12,
                      resize: false
                    }
                    e.currentTarget.setPointerCapture(e.pointerId)
                  }}
                  onPointerUp={(e) => {
                    const d = drag.current
                    drag.current = null
                    if (!d || d.resize) {
                      return
                    }
                    change(d.index, {
                      x: Math.max(
                        0,
                        Math.min(12 - d.w, d.x + Math.round((e.clientX - d.startX) / d.cell))
                      ),
                      y: Math.max(0, d.y + Math.round((e.clientY - d.startY) / 52))
                    })
                  }}
                >
                  {translate('itsaplan.planning.dashboards.drag', 'Drag to move')}
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className="cursor-se-resize rounded border p-1"
                  onPointerDown={(e) => {
                    const width = e.currentTarget.parentElement?.parentElement?.clientWidth || 600
                    drag.current = {
                      index: widget.sourceIndex,
                      startX: e.clientX,
                      startY: e.clientY,
                      x: widget.x,
                      y: widget.y,
                      w: widget.w,
                      h: widget.h,
                      cell: width / 12,
                      resize: true
                    }
                    e.currentTarget.setPointerCapture(e.pointerId)
                  }}
                  onPointerUp={(e) => {
                    const d = drag.current
                    drag.current = null
                    if (!d || !d.resize) {
                      return
                    }
                    change(d.index, {
                      w: Math.max(
                        1,
                        Math.min(12 - d.x, d.w + Math.round((e.clientX - d.startX) / d.cell))
                      ),
                      h: Math.max(1, d.h + Math.round((e.clientY - d.startY) / 52))
                    })
                  }}
                  onPointerCancel={() => {
                    drag.current = null
                  }}
                >
                  {translate('itsaplan.planning.dashboards.resize', 'Drag to resize')}
                </button>
                <WidgetSettings
                  widget={widget}
                  metadata={metadata}
                  planning={planning}
                  project={project}
                  disabled={disabled}
                  onChange={(updates) => change(widget.sourceIndex, updates)}
                />
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      [
                        'x',
                        translate('itsaplan.planning.dashboards.xPosition', 'X position'),
                        widget.x
                      ],
                      [
                        'y',
                        translate('itsaplan.planning.dashboards.yPosition', 'Y position'),
                        widget.y
                      ],
                      ['w', translate('itsaplan.planning.dashboards.width', 'Width'), widget.w],
                      ['h', translate('itsaplan.planning.dashboards.height', 'Height'), widget.h]
                    ] as const
                  ).map(([key, label, val]) => (
                    <label key={key}>
                      {label}
                      <input
                        className="w-16 rounded border bg-background p-1"
                        aria-label={label}
                        type="number"
                        min={key === 'w' || key === 'h' ? 1 : 0}
                        max={key === 'x' ? 12 - widget.w : key === 'w' ? 12 - widget.x : undefined}
                        disabled={disabled}
                        value={val}
                        onChange={(e) => {
                          const n = e.target.valueAsNumber
                          if (!Number.isFinite(n)) {
                            return
                          }
                          change(widget.sourceIndex, {
                            [key]: Math.max(
                              key === 'w' || key === 'h' ? 1 : 0,
                              Math.min(
                                key === 'x'
                                  ? 12 - widget.w
                                  : key === 'w'
                                    ? 12 - widget.x
                                    : Number.MAX_SAFE_INTEGER,
                                Math.floor(n)
                              )
                            )
                          })
                        }}
                      />
                    </label>
                  ))}
                </div>
              </>
            )}
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...value,
                  layout: value.layout.filter((_, i) => i !== widget.sourceIndex)
                })
              }
            >
              {translate('itsaplan.planning.dashboards.removeWidget', 'Remove widget')}
            </Button>
          </section>
        )
      })}
      <select
        aria-label={translate('itsaplan.planning.dashboards.widgetType', 'Widget type')}
        value={type}
        disabled={disabled}
        onChange={(e) => setType(e.target.value)}
      >
        {KNOWN_WIDGET_TYPES.map((t) => (
          <option key={t} value={t}>
            {widgetLabel(t)}
          </option>
        ))}
      </select>{' '}
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() =>
          onChange({
            ...value,
            layout: [
              ...value.layout,
              {
                id: createBrowserUuid(),
                type,
                x: 0,
                y: Math.max(0, ...readDashboardWidgets(value.layout).map((w) => w.y + w.h)),
                w: readDashboardWidgets([{ type }])[0].w,
                h: readDashboardWidgets([{ type }])[0].h,
                config: {}
              }
            ]
          })
        }
      >
        {translate('itsaplan.planning.dashboards.addWidget', 'Add widget')}
      </Button>
    </div>
  )
}
