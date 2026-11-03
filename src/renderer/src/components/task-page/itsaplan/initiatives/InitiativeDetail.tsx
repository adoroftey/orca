import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
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
  useEffect(() => {
    alive.current = true
    let active = true
    setLoading(true)
    setFeedLoading(true)
    setError(null)
    setFeedError(null)
    planning
      .getInitiative(id)
      .then((data) => {
        if (active) {
          setItem(data)
        }
      })
      .catch(() => {
        if (active) {
          setError(
            translate('itsaplan.planning.initiatives.detailError', 'Unable to load initiative.')
          )
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    planning
      .initiativeFeed(id)
      .then((data) => {
        if (active) {
          setFeed(data.items)
          setCursor(data.nextCursor)
        }
      })
      .catch(() => {
        if (active) {
          setFeedError(
            translate('itsaplan.planning.initiatives.feedError', 'Unable to load activity.')
          )
        }
      })
      .finally(() => {
        if (active) {
          setFeedLoading(false)
        }
      })
    return () => {
      active = false
      alive.current = false
    }
  }, [planning, id, refreshVersion])
  const save = async (updates: Partial<PlanningInitiativeInput>) => {
    setBusy(true)
    setError(null)
    try {
      const updated = await planning.updateInitiative(id, updates)
      if (alive.current) {
        setItem(updated)
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
    try {
      const page = await planning.initiativeFeed(id, { cursor })
      if (alive.current) {
        setFeed((old) => [...old, ...page.items])
        setCursor(page.nextCursor)
      }
    } catch {
      if (alive.current) {
        setFeedError(
          translate('itsaplan.planning.initiatives.feedError', 'Unable to load activity.')
        )
      }
    } finally {
      if (alive.current) {
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
              <h2>{item.title}</h2>
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
            <p>
              {item.description ||
                translate('itsaplan.planning.initiatives.noDescription', 'No description.')}
            </p>
            <p>
              {translate('itsaplan.planning.initiatives.status', 'Status')}:{' '}
              {initiativeValueLabel(item.status)} ·{' '}
              {translate('itsaplan.planning.initiatives.owner', 'Owner')}:{' '}
              {metadata.assignees.find((a) => a.userId === item.ownerUserId)?.name ??
                item.ownerUserId ??
                translate('itsaplan.planning.initiatives.unassigned', 'Unassigned')}{' '}
              · {translate('itsaplan.planning.initiatives.priority', 'Priority')}:{' '}
              {item.priority ? initiativeValueLabel(item.priority) : '—'}
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
            <InitiativeIssues
              api={api}
              planning={planning}
              projectRef={projectRef}
              initiativeId={id}
              metadata={metadata}
              onOpenIssue={onOpenIssue}
              refreshVersion={refreshVersion}
            />
            <section>
              <h3>{translate('itsaplan.planning.initiatives.activity', 'Activity')}</h3>
              {feed.map((entry) => (
                <p key={entry.id}>
                  {entry.actorName ??
                    translate('itsaplan.planning.initiatives.unknownActor', 'Unknown')}{' '}
                  · {entry.kind} · {entry.body}{' '}
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
