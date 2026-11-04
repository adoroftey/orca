import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanApi,
  ItsaplanIssue,
  ItsaplanProject,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import type {
  ItsaplanPlanningApi,
  PlanningDashboard
} from '../../../../../../shared/itsaplan/planning-types'
import { DashboardGrid } from './DashboardGrid'
import { DashboardEditor } from './DashboardEditor'
import { buildDashboardChanges } from './dashboard-edits'
import { DashboardDeleteDialog } from './DashboardDeleteDialog'

type Props = {
  api: ItsaplanApi
  planning: ItsaplanPlanningApi
  project: ItsaplanProject
  metadata: ItsaplanProjectDetails
  onOpenIssue: (id: number) => void
  refreshVersion?: number
}
export function ItsaplanDashboardsPanel(props: Props) {
  return <Panel key={props.project.ref} {...props} />
}
function Panel({ api, planning, project, metadata, onOpenIssue, refreshVersion = 0 }: Props) {
  const [dashboards, setDashboards] = useState<PlanningDashboard[]>([])
  const [issues, setIssues] = useState<ItsaplanIssue[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [original, setOriginal] = useState<PlanningDashboard | null>(null)
  const [draft, setDraft] = useState<PlanningDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [life] = useState(() => ({ active: true }))
  const permissions = metadata.permissions?.dashboards
  const canRead = permissions?.read === true && project.dashboardsEnabled !== false
  useEffect(() => {
    life.active = true
    return () => {
      life.active = false
    }
  }, [life])
  useEffect(() => {
    if (!canRead) {
      return
    }
    let active = true
    setLoading(true)
    setError('')
    Promise.all([planning.listDashboards(project.ref), api.listIssues(project.ref)])
      .then(([items, board]) => {
        if (active) {
          setDashboards(items)
          setIssues(board)
        }
      })
      .catch(() => {
        if (active) {
          setError(
            translate('itsaplan.planning.dashboards.loadError', 'Unable to load dashboards.')
          )
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [api, planning, project.ref, canRead, refreshVersion, version])
  const view = dashboards.find((item) => item.id === selected)
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await action()
      if (life.active) {
        setVersion((v) => v + 1)
      }
    } catch {
      if (life.active) {
        setError(
          translate('itsaplan.planning.dashboards.actionError', 'Unable to update the dashboard.')
        )
      }
    } finally {
      if (life.active) {
        setBusy(false)
      }
    }
  }
  const create = (source?: PlanningDashboard) =>
    run(async () => {
      const item = await planning.createDashboard(project.ref, {
        name: source ? `${source.name} copy` : 'New dashboard',
        icon: source?.icon ?? null,
        layout: source?.layout ?? []
      })
      if (life.active) {
        setSelected(item.id)
      }
    })
  if (!canRead) {
    return (
      <p>
        {translate(
          'itsaplan.planning.dashboards.noAccess',
          'Dashboards are unavailable for this project.'
        )}
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button variant="outline" disabled={busy} onClick={() => setVersion((v) => v + 1)}>
          {translate('itsaplan.planning.dashboards.reload', 'Reload')}
        </Button>
        {permissions?.create === true && (
          <Button disabled={busy} onClick={() => void create()}>
            {translate('itsaplan.planning.dashboards.new', 'New dashboard')}
          </Button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {loading && (
        <p>{translate('itsaplan.planning.dashboards.loadingDashboards', 'Loading dashboards…')}</p>
      )}
      <nav className="flex flex-wrap gap-2">
        {dashboards.map((item) => (
          <Button
            key={item.id}
            variant={selected === item.id ? 'default' : 'outline'}
            disabled={!!draft}
            onClick={() => setSelected(item.id)}
          >
            {item.icon} {item.name}
          </Button>
        ))}
      </nav>
      {!loading && dashboards.length === 0 && (
        <p>{translate('itsaplan.planning.dashboards.emptyDashboards', 'No saved dashboards.')}</p>
      )}
      {view && (
        <>
          <div className="flex flex-wrap gap-2">
            <h2 className="font-semibold">{view.name}</h2>
            {!draft && permissions?.edit === true && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setOriginal(structuredClone(view))
                  setDraft(structuredClone(view))
                }}
              >
                {translate('itsaplan.planning.dashboards.edit', 'Edit')}
              </Button>
            )}
            {!draft && permissions?.create === true && (
              <Button variant="outline" disabled={busy} onClick={() => void create(view)}>
                {translate('itsaplan.planning.dashboards.copy', 'Copy')}
              </Button>
            )}
            {!draft && permissions?.delete === true && (
              <DashboardDeleteDialog
                disabled={busy}
                onConfirm={() =>
                  void run(async () => {
                    await planning.deleteDashboard(view.id)
                    if (life.active) {
                      setSelected(null)
                    }
                  })
                }
              />
            )}
          </div>
          {draft ? (
            <>
              <DashboardEditor
                value={draft}
                metadata={metadata}
                planning={planning}
                project={project}
                disabled={busy}
                onChange={setDraft}
              />
              <div className="flex gap-2">
                <Button
                  disabled={busy || !draft.name.trim()}
                  onClick={() =>
                    void (async () => {
                      if (!original) {
                        return
                      }
                      const changes = buildDashboardChanges(original, draft)
                      if (!Object.keys(changes).length) {
                        setDraft(null)
                        return
                      }
                      setBusy(true)
                      setError('')
                      try {
                        const latest = (await planning.listDashboards(project.ref)).find(
                          (item) => item.id === original.id
                        )
                        if (!life.active) {
                          return
                        }
                        const remote = latest && buildDashboardChanges(original, latest)
                        if (
                          !remote ||
                          Object.keys(changes).some((key) => Object.hasOwn(remote, key))
                        ) {
                          setError(
                            translate(
                              'itsaplan.planning.dashboards.conflict',
                              'Conflict: this dashboard changed. Reload or discard your changes.'
                            )
                          )
                          return
                        }
                        await planning.updateDashboard(original.id, changes)
                        if (life.active) {
                          setDraft(null)
                          setVersion((v) => v + 1)
                        }
                      } catch {
                        if (life.active) {
                          setError(
                            translate(
                              'itsaplan.planning.dashboards.actionError',
                              'Unable to update the dashboard.'
                            )
                          )
                        }
                      } finally {
                        if (life.active) {
                          setBusy(false)
                        }
                      }
                    })()
                  }
                >
                  {translate('itsaplan.planning.dashboards.save', 'Save')}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setDraft(null)}>
                  {translate('itsaplan.planning.dashboards.discard', 'Discard')}
                </Button>
              </div>
            </>
          ) : (
            <DashboardGrid
              layout={view.layout}
              api={api}
              planning={planning}
              project={project}
              metadata={metadata}
              issues={issues}
              onOpenIssue={onOpenIssue}
            />
          )}
        </>
      )}
    </div>
  )
}
