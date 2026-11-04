import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanApi,
  ItsaplanConnectionStatus,
  ItsaplanProject,
  ItsaplanProjectDetails
} from '../../../../../shared/itsaplan/types'
import { ItsaplanProjectTasks, type ItsaplanWorkspaceActions } from './ProjectTasks'
import { ItsaplanIssueDetails } from './IssueDetails'
import { ItsaplanInitiativesPanel } from './initiatives/InitiativesPanel'
import { ItsaplanViewsPanel } from './views/ViewsPanel'
import { ItsaplanDashboardsPanel } from './dashboards/DashboardsPanel'
import { itsaplanErrorMessage } from './request-state'

type Section = 'issues' | 'initiatives' | 'views' | 'dashboards'
type Props = {
  api: ItsaplanApi
  connection: ItsaplanConnectionStatus
  project: ItsaplanProject
  initialSection?: Section
} & ItsaplanWorkspaceActions

export function PlanningShell(props: Props) {
  if (!props.api.planning) {
    return <ItsaplanProjectTasks {...props} />
  }
  return <PlanningContent {...props} />
}
function PlanningContent({
  api,
  connection,
  project,
  initialSection = 'issues',
  ...actions
}: Props) {
  const [section, setSection] = useState<Section>(initialSection)
  const [visited, setVisited] = useState<Section[]>([initialSection])
  const [metadata, setMetadata] = useState<ItsaplanProjectDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [issueId, setIssueId] = useState<number | null>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)
  useEffect(() => {
    let active = true
    setError(null)
    setMetadata(null)
    void api
      .getProject(project.ref)
      .then((result) => {
        if (active) {
          setMetadata(result)
          void api.planning
            ?.capabilities()
            .then(({ timeZone }) => {
              if (active && timeZone) {
                setMetadata((current) =>
                  current ? { ...current, viewer: { ...current.viewer, timeZone } } : current
                )
              }
            })
            .catch(() => {})
        }
      })
      .catch((failure) => {
        if (active) {
          setError(itsaplanErrorMessage(failure))
        }
      })
    return () => {
      active = false
    }
  }, [api, project.ref, retry])
  const effectiveProject = { ...project, ...metadata?.project }
  const labels: Record<Section, string> = {
    issues: translate('itsaplan.planning.navigation.issues', 'Issues'),
    initiatives: translate('itsaplan.planning.navigation.initiatives', 'Initiatives'),
    views: translate('itsaplan.planning.navigation.views', 'Views'),
    dashboards: translate('itsaplan.planning.navigation.dashboards', 'Dashboards')
  }
  const sections: Section[] = [
    'issues',
    ...(effectiveProject.initiativesEnabled === false ? [] : ['initiatives' as const]),
    'views',
    ...(effectiveProject.dashboardsEnabled === false ? [] : ['dashboards' as const])
  ]
  const panelProps =
    metadata && api.planning
      ? {
          api,
          planning: api.planning,
          project: effectiveProject,
          metadata,
          onOpenIssue: setIssueId,
          refreshVersion,
          webBaseUrl: connection.webBaseUrl ?? connection.baseUrl ?? undefined
        }
      : null
  const activeSection = sections.includes(section) ? section : 'issues'
  return (
    <>
      <nav
        aria-label={translate('itsaplan.planning.navigation.label', 'Planning sections')}
        className="flex gap-1 overflow-x-auto border-b border-border p-2"
        hidden={issueId !== null}
        style={{ display: issueId !== null ? 'none' : undefined }}
      >
        {sections.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={activeSection === item ? 'secondary' : 'ghost'}
            aria-pressed={activeSection === item}
            onClick={() => {
              setSection(item)
              setVisited((old) => (old.includes(item) ? old : [...old, item]))
            }}
          >
            {labels[item]}
          </Button>
        ))}
      </nav>
      {error ? (
        <div role="alert" className="space-y-2 p-4 text-destructive">
          <p>{error}</p>
          <Button variant="outline" onClick={() => setRetry((v) => v + 1)}>
            {translate('itsaplan.retry', 'Retry')}
          </Button>
        </div>
      ) : !metadata ? (
        <p role="status" className="p-4">
          {translate('itsaplan.planning.navigation.loading', 'Loading project…')}
        </p>
      ) : (
        <>
          <div
            hidden={activeSection !== 'issues' || issueId !== null}
            className="min-h-0 flex-1 flex-col overflow-hidden"
            style={{ display: activeSection === 'issues' && issueId === null ? 'flex' : 'none' }}
          >
            {visited.includes('issues') && (
              <ItsaplanProjectTasks
                api={api}
                connection={connection}
                project={project}
                {...actions}
              />
            )}
          </div>
          {panelProps &&
            (['initiatives', 'views', 'dashboards'] as const).map(
              (item) =>
                sections.includes(item) &&
                visited.includes(item) && (
                  <div
                    key={item}
                    hidden={activeSection !== item || issueId !== null}
                    className="min-h-0 flex-1 overflow-auto p-4 scrollbar-sleek"
                  >
                    {item === 'initiatives' ? (
                      <ItsaplanInitiativesPanel {...panelProps} />
                    ) : item === 'views' ? (
                      <ItsaplanViewsPanel {...panelProps} />
                    ) : (
                      <ItsaplanDashboardsPanel {...panelProps} />
                    )}
                  </div>
                )
            )}
          {issueId !== null && (
            <ItsaplanIssueDetails
              key={issueId}
              api={api}
              issueId={issueId}
              issueUrl={
                connection.webBaseUrl || connection.baseUrl
                  ? `${(connection.webBaseUrl ?? connection.baseUrl)?.replace(/\/+$/, '')}/issue/${issueId}`
                  : undefined
              }
              metadata={metadata}
              onBack={() => setIssueId(null)}
              onChanged={() => setRefreshVersion((v) => v + 1)}
              onUseIssue={(issue) => actions.onUseIssue(issue, project, connection)}
              onOpenIssue={
                actions.onOpenIssue
                  ? (issue) => actions.onOpenIssue?.(issue, project, connection)
                  : undefined
              }
              onAttachIssue={
                actions.onAttachIssue
                  ? (issue, workspaceId) =>
                      actions.onAttachIssue?.(issue, project, connection, workspaceId) ??
                      Promise.resolve()
                  : undefined
              }
              workspaces={actions.workspaces}
              linkedWorkspaceName={(issue) =>
                actions.linkedWorkspaceName?.(issue, project, connection) ?? null
              }
            />
          )}
        </>
      )}
    </>
  )
}
