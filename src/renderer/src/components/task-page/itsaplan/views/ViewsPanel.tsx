import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ViewConfirmation } from './ViewActions'
import { ViewControls, ViewHeader } from './ViewControls'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanApi,
  ItsaplanIssue,
  ItsaplanProject,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import type {
  ItsaplanPlanningApi,
  PlanningView
} from '../../../../../../shared/itsaplan/planning-types'
import { ViewEditor, ViewContent } from './ViewEditor'
import { noCapabilities, saveView } from './view-edits'
type Props = {
  api: ItsaplanApi
  planning: ItsaplanPlanningApi
  project: ItsaplanProject
  metadata: ItsaplanProjectDetails
  onOpenIssue: (id: number) => void
  refreshVersion?: number
  webBaseUrl?: string
}
export function ItsaplanViewsPanel(props: Props) {
  return <ViewsPanel key={props.project.ref} {...props} />
}
function ViewsPanel({
  api,
  planning,
  project,
  metadata,
  onOpenIssue,
  refreshVersion = 0,
  webBaseUrl
}: Props) {
  const [views, setViews] = useState<PlanningView[]>([])
  const [issues, setIssues] = useState<ItsaplanIssue[]>([])
  const [caps, setCaps] = useState(noCapabilities)
  const [selected, setSelected] = useState<number | null>(null)
  const [draft, setDraft] = useState<PlanningView | null>(null)
  const [original, setOriginal] = useState<PlanningView | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [confirmation, setConfirmation] = useState<'delete' | 'publish' | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [life] = useState(() => ({ active: true }))
  const permissions = metadata.permissions?.views
  const canRead = permissions?.read === true
  useEffect(() => {
    life.active = true
    return () => {
      life.active = false
    }
  }, [life])
  useEffect(() => {
    let active = true
    planning
      .capabilities()
      .then((c) => {
        if (active) {
          setCaps(c)
        }
      })
      .catch(() => {
        if (active) {
          setCaps(noCapabilities)
        }
      })
    return () => {
      active = false
    }
  }, [planning])
  useEffect(() => {
    if (!canRead) {
      return
    }
    let active = true
    setLoading(true)
    setError('')
    Promise.all([planning.listViews(project.ref), api.listIssues(project.ref)])
      .then(([v, i]) => {
        if (active) {
          setViews(v)
          setIssues(i)
        }
      })
      .catch(() => {
        if (active) {
          setError(translate('itsaplan.planning.views.loadError', 'Unable to load views.'))
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
  }, [api, planning, project.ref, version, canRead, refreshVersion])
  const view = views.find((v) => v.id === selected)
  const canEdit =
    !!view && (view.isPrivate === true ? canRead && caps.privateViews : permissions?.edit === true)
  const refresh = () => {
    if (life.active) {
      setVersion((v) => v + 1)
    }
  }
  const run = async (action: () => Promise<unknown>, after?: () => void) => {
    setBusy(true)
    setError('')
    try {
      await action()
      if (life.active) {
        after?.()
        refresh()
      }
    } catch {
      if (life.active) {
        setError(translate('itsaplan.planning.views.actionError', 'Unable to update the view.'))
      }
    } finally {
      if (life.active) {
        setBusy(false)
      }
    }
  }
  if (!canRead) {
    return (
      <p>
        {translate('itsaplan.planning.views.noAccess', 'Views are unavailable for this project.')}
      </p>
    )
  }
  const moveView = (direction: number) => {
    if (!view) {
      return
    }
    const ids = views.map((v) => v.id)
    const index = ids.indexOf(view.id)
    const next = index + direction
    if (next < 0 || next >= ids.length) {
      return
    }
    ;[ids[index], ids[next]] = [ids[next], ids[index]]
    void run(() =>
      caps.tabOrder
        ? planning.arrangeViewTabs(project.ref, ids)
        : planning.reorderViews(project.ref, ids)
    )
  }
  const newView = (source?: PlanningView, isPrivate = false) =>
    run(async () => {
      const created = await planning.createView(project.ref, {
        name: source
          ? `${source.name} ${translate('itsaplan.planning.views.copySuffix', 'copy')}`
          : isPrivate
            ? translate('itsaplan.planning.views.newPrivate', 'New private view')
            : translate('itsaplan.planning.views.new', 'New view'),
        icon: source?.icon ?? null,
        filters: source?.filters ?? {},
        display: source?.display ?? {},
        ...((source?.isPrivate || isPrivate) && caps.privateViews ? { isPrivate: true } : {})
      })
      if (life.active) {
        setSelected(created.id)
      }
    })
  return (
    <div className="space-y-3">
      <ViewControls
        views={views}
        selected={selected}
        draft={draft}
        busy={busy}
        loading={loading}
        error={error}
        showHidden={showHidden}
        caps={caps}
        canRead={canRead}
        canCreate={permissions?.create === true}
        refresh={refresh}
        newView={newView}
        setShowHidden={setShowHidden}
        setSelected={setSelected}
      />
      {view && (
        <ViewConfirmation
          confirmation={confirmation}
          setConfirmation={setConfirmation}
          busy={busy}
          onDelete={() =>
            void run(
              () => planning.deleteView(view.id),
              () => setSelected(null)
            )
          }
          onPublish={() => void run(() => planning.publishView(view.id))}
        />
      )}
      {view && (
        <>
          <ViewHeader
            view={view}
            draft={draft}
            canEdit={canEdit}
            busy={busy}
            caps={caps}
            canRead={canRead}
            permissions={permissions}
            setOriginal={setOriginal}
            setDraft={setDraft}
            newView={newView}
            setConfirmation={setConfirmation}
            moveView={moveView}
            run={run}
            planning={planning}
          />
          {draft ? (
            <>
              <p>{translate('itsaplan.planning.views.unsaved', 'Unsaved changes')}</p>
              <ViewEditor
                value={draft}
                metadata={metadata}
                disabled={busy}
                onChange={setDraft}
                issues={issues}
                planning={planning}
                projectRef={project.ref}
              />
              <div className="flex gap-2">
                <Button
                  disabled={busy || !draft.name.trim()}
                  onClick={() =>
                    saveView({
                      original,
                      draft,
                      planning,
                      projectRef: project.ref,
                      life,
                      setDraft,
                      setBusy,
                      setError,
                      refresh
                    })
                  }
                >
                  {translate('itsaplan.planning.views.save', 'Save')}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setDraft(null)}>
                  {translate('itsaplan.planning.views.discard', 'Discard')}
                </Button>
              </div>
            </>
          ) : (
            <ViewContent
              api={api}
              metadata={metadata}
              view={view}
              webBaseUrl={webBaseUrl}
              projectRef={project.ref}
              projectKey={project.key}
              issues={issues}
              onOpenIssue={onOpenIssue}
              onUpdated={refresh}
            />
          )}
        </>
      )}
    </div>
  )
}
