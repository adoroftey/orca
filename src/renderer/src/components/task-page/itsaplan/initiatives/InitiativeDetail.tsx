import { ItsaplanDescription } from '../ItsaplanDescription'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import type { ItsaplanApi, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
import type {
  ItsaplanPlanningApi,
  PlanningActivityItem,
  PlanningInitiative,
  PlanningInitiativeInput
} from '../../../../../../shared/itsaplan/planning-types'
import { InitiativeForm, InitiativeDeleteDialog, initiativeValueLabel } from './InitiativeForm'
import { InitiativeIssues } from './InitiativeIssues'
function activityStatus(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('value' in value)) {
    return null
  }
  return typeof value.value === 'string' ? value.value : null
}
function activityMovement(entry: PlanningActivityItem): string | null {
  if (entry.action !== 'status' || !entry.payload || typeof entry.payload !== 'object') {
    return null
  }
  const payload = entry.payload
  const from = 'from' in payload ? activityStatus(payload.from) : null
  const to = 'to' in payload ? activityStatus(payload.to) : null
  return from && to ? `${from} → ${to}` : null
}
export function InitiativeDetail({
  api,
  planning,
  id,
  projectRef,
  metadata,
  onBack,
  onChanged,
  onOpenIssue,
  refreshVersion = 0
}: {
  api: ItsaplanApi
  planning: ItsaplanPlanningApi
  id: number
  projectRef: string
  metadata: ItsaplanProjectDetails
  onBack: () => void
  onChanged: () => void
  onOpenIssue: (id: number) => void
  refreshVersion?: number
}) {
  const [item, setItem] = useState<PlanningInitiative | null>(null)
  const [feed, setFeed] = useState<PlanningActivityItem[]>([])
  const [cursor, setCursor] = useState<{ ts: string; id: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedLoading, setFeedLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedError, setFeedError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  const [issueVersion, setIssueVersion] = useState(0)
  const requestGeneration = useRef(0)
  const previousScope = useRef('')
  useEffect(() => {
    alive.current = true
    let active = true
    const generation = ++requestGeneration.current
    const scope = JSON.stringify([id, projectRef, refreshVersion])
    if (previousScope.current !== scope) {
      previousScope.current = scope
      setLoading(true)
    }
    setFeedLoading(true)
    setError(null)
    setFeedError(null)
    planning
      .getInitiative(id)
      .then((data) => {
        if (active && requestGeneration.current === generation) {
          setItem(data)
        }
      })
      .catch(() => {
        if (active && requestGeneration.current === generation) {
          setError(
            translate('itsaplan.planning.initiatives.detailError', 'Unable to load initiative.')
          )
        }
      })
      .finally(() => {
        if (active && requestGeneration.current === generation) {
          setLoading(false)
        }
      })
    planning
      .initiativeFeed(id)
      .then((data) => {
        if (active && requestGeneration.current === generation) {
          setFeed(data.items)
          setCursor(data.nextCursor)
        }
      })
      .catch(() => {
        if (active && requestGeneration.current === generation) {
          setFeedError(
            translate('itsaplan.planning.initiatives.feedError', 'Unable to load activity.')
          )
        }
      })
      .finally(() => {
        if (active && requestGeneration.current === generation) {
          setFeedLoading(false)
        }
      })
    return () => {
      active = false
      alive.current = false
    }
  }, [planning, id, projectRef, refreshVersion, issueVersion])
  const save = async (updates: Partial<PlanningInitiativeInput>) => {
    setBusy(true)
    setError(null)
    try {
      const updated = await planning.updateInitiative(id, updates)
      if (alive.current) {
        requestGeneration.current++
        setItem(updated)
        setIssueVersion((version) => version + 1)
        setEditing(false)
        onChanged()
      }
    } catch {
      if (alive.current) {
        setError(translate('itsaplan.planning.initiatives.saveError', 'Unable to save initiative.'))
      }
    } finally {
      if (alive.current) {
        setBusy(false)
      }
    }
  }
  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await planning.deleteInitiative(id)
      if (alive.current) {
        onChanged()
        onBack()
      }
    } catch {
      if (alive.current) {
        setConfirming(false)
        setError(
          translate('itsaplan.planning.initiatives.deleteError', 'Unable to delete initiative.')
        )
      }
    } finally {
      if (alive.current) {
        setBusy(false)
      }
    }
  }
  const more = async () => {
    if (!cursor) {
      return
    }
    setFeedLoading(true)
    setFeedError(null)
    const generation = requestGeneration.current
    try {
      const page = await planning.initiativeFeed(id, { cursor })
      if (alive.current && requestGeneration.current === generation) {
        setFeed((old) => [...old, ...page.items])
        setCursor(page.nextCursor)
      }
    } catch {
      if (alive.current && requestGeneration.current === generation) {
        setFeedError(
          translate('itsaplan.planning.initiatives.feedError', 'Unable to load activity.')
        )
      }
    } finally {
      if (alive.current && requestGeneration.current === generation) {
        setFeedLoading(false)
      }
    }
  }
  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}>
        {translate('itsaplan.planning.initiatives.back', 'Back to initiatives')}
      </Button>
      {loading && (
        <p>{translate('itsaplan.planning.initiatives.detailLoading', 'Loading initiative…')}</p>
      )}
      {error && !editing && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {item &&
        !loading &&
        (editing ? (
          <InitiativeForm
            item={item}
            metadata={metadata}
            busy={busy}
            error={error}
            onSave={(input) => void save(input)}
            onCancel={() => {
              setEditing(false)
              setError(null)
            }}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{item.title}</h2>
              {metadata.permissions?.initiatives?.edit === true && (
                <Button onClick={() => setEditing(true)}>
                  {translate('itsaplan.planning.initiatives.edit', 'Edit')}
                </Button>
              )}
              {metadata.permissions?.initiatives?.delete === true && (
                <Button variant="destructive" onClick={() => setConfirming(true)}>
                  {translate('itsaplan.planning.initiatives.delete', 'Delete')}
                </Button>
              )}
            </div>
            <ItsaplanDescription
              content={
                item.description ||
                translate('itsaplan.planning.initiatives.noDescription', 'No description.')
              }
            />
            <p>
              {translate('itsaplan.planning.initiatives.status', 'Status')}:{' '}
              <Badge variant="secondary">{initiativeValueLabel(item.status)}</Badge> ·{' '}
              {translate('itsaplan.planning.initiatives.owner', 'Owner')}:{' '}
              {metadata.assignees.find((a) => a.userId === item.ownerUserId)?.name ??
                item.ownerUserId ??
                translate('itsaplan.planning.initiatives.unassigned', 'Unassigned')}{' '}
              · {translate('itsaplan.planning.initiatives.priority', 'Priority')}:{' '}
              <Badge variant="outline">
                {item.priority ? initiativeValueLabel(item.priority) : '—'}
              </Badge>
            </p>
            <p>
              {translate('itsaplan.planning.initiatives.startDate', 'Start date')}:{' '}
              {item.startDate ?? '—'} ·{' '}
              {translate('itsaplan.planning.initiatives.targetDate', 'Target date')}:{' '}
              {item.targetDate ?? '—'}
            </p>
            <p>
              {translate('itsaplan.planning.initiatives.labels', 'Labels')}:{' '}
              {item.labelIds
                .map((id) => metadata.labels?.find((label) => label.id === id)?.name ?? String(id))
                .join(', ') || '—'}
            </p>
            <p>
              {translate('itsaplan.planning.initiatives.progress', 'Progress')}:{' '}
              {item.progress.completed} / {item.progress.total} (
              {translate('itsaplan.planning.initiatives.canceled', 'Canceled')}:{' '}
              {item.progress.canceled}) ·{' '}
              {translate('itsaplan.planning.initiatives.health', 'Health')}: {item.health ?? '—'}
            </p>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={translate('itsaplan.planning.initiatives.progress', 'Progress')}
              aria-valuemin={0}
              aria-valuemax={item.progress.total}
              aria-valuenow={item.progress.completed}
            >
              <div
                className="h-full bg-primary"
                style={{
                  width: `${item.progress.total ? Math.min(100, (item.progress.completed / item.progress.total) * 100) : 0}%`
                }}
              />
            </div>
            <InitiativeIssues
              key={`${projectRef}:${id}`}
              api={api}
              planning={planning}
              projectRef={projectRef}
              initiativeId={id}
              metadata={metadata}
              onOpenIssue={onOpenIssue}
              onIssuesChanged={() => {
                requestGeneration.current++
                setIssueVersion((version) => version + 1)
              }}
              refreshVersion={refreshVersion}
            />
            <section>
              <h3>{translate('itsaplan.planning.initiatives.activity', 'Activity')}</h3>
              {feed.map((entry) => (
                <p key={entry.id} className="border-b py-2 text-sm">
                  <time className="mr-2 text-muted-foreground" dateTime={entry.createdAt}>
                    {entry.createdAt}
                  </time>
                  {entry.actorName ??
                    translate('itsaplan.planning.initiatives.unknownActor', 'Unknown')}{' '}
                  · {entry.action ?? entry.kind} {activityMovement(entry) ?? entry.body}{' '}
                  {entry.issueId && (
                    <Button variant="link" onClick={() => onOpenIssue(entry.issueId!)}>
                      {entry.issueIdentifier ?? entry.issueTitle ?? String(entry.issueId)}
                    </Button>
                  )}
                </p>
              ))}
              {!feedLoading && !feed.length && !feedError && (
                <p>{translate('itsaplan.planning.initiatives.feedEmpty', 'No activity yet.')}</p>
              )}
              {feedLoading && (
                <p>{translate('itsaplan.planning.initiatives.feedLoading', 'Loading activity…')}</p>
              )}
              {feedError && <p role="alert">{feedError}</p>}
              {cursor && (
                <Button disabled={feedLoading} onClick={() => void more()}>
                  {translate('itsaplan.planning.initiatives.moreActivity', 'Load more activity')}
                </Button>
              )}
            </section>
          </>
        ))}
      <InitiativeDeleteDialog
        open={confirming}
        busy={busy}
        onOpenChange={setConfirming}
        onDelete={() => void remove()}
      />
    </div>
  )
}
