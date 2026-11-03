import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import type {
  PlanningView,
  ItsaplanPlanningApi
} from '../../../../../../shared/itsaplan/planning-types'
import type {
  ItsaplanProjectDetails,
  ItsaplanApi,
  ItsaplanIssue
} from '../../../../../../shared/itsaplan/types'
import { PlanningFilterEditor } from './FilterEditor'
import { ViewDisplayEditor, unsupported } from './ViewDisplayEditor'
import { applyPlanningFilters, sortPlanningIssues } from './view-model'
import { ViewKanban } from './ViewKanban'
import { ViewTable } from './ViewTable'
import { ViewCalendar } from './ViewCalendar'
import { ViewTimeline } from './ViewTimeline'
export function ViewEditor({
  value,
  metadata,
  onChange,
  disabled,
  issues,
  planning,
  projectRef
}: {
  value: PlanningView
  metadata: ItsaplanProjectDetails
  onChange: (view: PlanningView) => void
  disabled?: boolean
  issues?: ItsaplanIssue[]
  planning?: ItsaplanPlanningApi
  projectRef?: string
}) {
  return (
    <div className="space-y-3">
      <label>
        {translate('itsaplan.planning.views.name', 'Name')}
        <Input
          disabled={disabled}
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </label>
      <label>
        {translate('itsaplan.planning.views.icon', 'Icon')}
        <Input
          disabled={disabled}
          value={value.icon ?? ''}
          onChange={(e) => onChange({ ...value, icon: e.target.value || null })}
        />
      </label>
      <PlanningFilterEditor
        value={value.filters}
        metadata={metadata}
        issues={issues}
        planning={planning}
        projectRef={projectRef}
        disabled={disabled}
        onChange={(filters) => onChange({ ...value, filters })}
      />
      <ViewDisplayEditor
        value={value.display}
        metadata={metadata}
        issues={issues}
        disabled={disabled}
        onChange={(display) => onChange({ ...value, display })}
      />
    </div>
  )
}

export function ViewContent({
  api,
  metadata,
  view,
  issues,
  onOpenIssue,
  onUpdated,
  webBaseUrl,
  projectRef,
  projectKey
}: {
  api: ItsaplanApi
  metadata: ItsaplanProjectDetails
  view: PlanningView
  issues: ItsaplanIssue[]
  onOpenIssue: (id: number) => void
  onUpdated: () => void
  webBaseUrl?: string
  projectRef?: string
  projectKey?: string
}) {
  const result = applyPlanningFilters(issues, view.filters, metadata)
  const problems = [...result.unsupported, ...unsupported(view.display, metadata)]
  if (problems.length) {
    const href = viewWebUrl(webBaseUrl, projectRef, projectKey, view.id)
    return (
      <p role="alert">
        {translate('itsaplan.planning.views.unsupported', 'This view has unsupported settings:')}{' '}
        {problems.join(', ')}
        {href && (
          <>
            {' '}
            <a href={href} target="_blank" rel="noopener noreferrer">
              {translate('itsaplan.planning.views.openInItsplan', 'Open in Itsplan')}
            </a>
          </>
        )}
      </p>
    )
  }
  const sorted = sortPlanningIssues(result.issues, view.display.sort, metadata)
  const props = {
    issues: sorted,
    allIssues: sorted,
    filters: view.filters,
    metadata,
    display: view.display,
    onOpenIssue
  }
  const layout = view.display.layout ?? 'kanban'
  if (layout === 'table') {
    return <ViewTable {...props} />
  }
  if (layout === 'calendar') {
    return <ViewCalendar {...props} />
  }
  if (layout === 'timeline') {
    return <ViewTimeline {...props} />
  }
  return (
    <ViewKanban
      {...props}
      api={api}
      canEdit={metadata.permissions?.work_items?.edit === true}
      onUpdated={onUpdated}
    />
  )
}

function viewWebUrl(
  base: string | undefined,
  ref: string | undefined,
  key: string | undefined,
  id: number
): string | undefined {
  if (!base || !ref || !key) {
    return undefined
  }
  const separator = ref.lastIndexOf('.')
  if (separator <= 0 || separator === ref.length - 1) {
    return undefined
  }
  try {
    const url = new URL(base)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      return undefined
    }
    url.search = ''
    url.hash = ''
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/${encodeURIComponent(ref.slice(0, separator))}/${encodeURIComponent(key)}/view/${encodeURIComponent(String(id))}`
    return url.toString()
  } catch {
    return undefined
  }
}
