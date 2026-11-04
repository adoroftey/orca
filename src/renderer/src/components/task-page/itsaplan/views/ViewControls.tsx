import { Button } from '@/components/ui/button'
import { Lock, Users } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type {
  ItsaplanPlanningApi,
  PlanningCapabilities,
  PlanningView
} from '../../../../../../shared/itsaplan/planning-types'

type Props = {
  views: PlanningView[]
  selected: number | null
  draft: PlanningView | null
  busy: boolean
  loading: boolean
  error: string
  showHidden: boolean
  caps: PlanningCapabilities
  canRead: boolean
  canCreate: boolean
  refresh: () => void
  newView: (source?: PlanningView, isPrivate?: boolean) => Promise<void>
  setShowHidden: (value: boolean) => void
  setSelected: (value: number) => void
}
export function ViewControls({
  views,
  selected,
  draft,
  busy,
  loading,
  error,
  showHidden,
  caps,
  canRead,
  canCreate,
  refresh,
  newView,
  setShowHidden,
  setSelected
}: Props) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={refresh} disabled={busy}>
          {translate('itsaplan.planning.views.reload', 'Reload')}
        </Button>
        {canCreate && (
          <Button onClick={() => newView()} disabled={busy}>
            {translate('itsaplan.planning.views.new', 'New view')}
          </Button>
        )}
        {caps.privateViews && canRead && (
          <Button variant="outline" disabled={busy} onClick={() => newView(undefined, true)}>
            {translate('itsaplan.planning.views.newPrivate', 'New private view')}
          </Button>
        )}
        {caps.hiddenViews && (
          <Button variant="outline" disabled={busy} onClick={() => setShowHidden(!showHidden)}>
            {showHidden
              ? translate('itsaplan.planning.views.hideHidden', 'Hide hidden views')
              : translate('itsaplan.planning.views.showHidden', 'Show hidden views')}
          </Button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {loading && <p>{translate('itsaplan.planning.views.loading', 'Loading views…')}</p>}
      <nav className="flex flex-wrap gap-2">
        {views
          .filter((v) => !v.hidden || showHidden)
          .map((v) => (
            <Button
              key={v.id}
              aria-label={v.name}
              variant={selected === v.id ? 'default' : 'outline'}
              disabled={!!draft}
              onClick={() => setSelected(v.id)}
            >
              {v.icon} {v.name}
              {v.isPrivate ? (
                <Lock aria-label={translate('itsaplan.planning.views.private', 'Private')} />
              ) : (
                <Users aria-label={translate('itsaplan.planning.views.shared', 'Shared')} />
              )}
              {v.hidden && <span>{translate('itsaplan.planning.views.hidden', 'Hidden')}</span>}
            </Button>
          ))}
      </nav>
      {!loading && views.length === 0 && (
        <p>{translate('itsaplan.planning.views.empty', 'No saved views.')}</p>
      )}
    </>
  )
}

type HeaderProps = {
  view: PlanningView
  draft: PlanningView | null
  canEdit: boolean
  busy: boolean
  caps: PlanningCapabilities
  canRead: boolean
  permissions?: { create?: boolean; delete?: boolean; edit?: boolean }
  setOriginal: (view: PlanningView) => void
  setDraft: (view: PlanningView) => void
  newView: (source?: PlanningView, isPrivate?: boolean) => Promise<void>
  setConfirmation: (value: 'delete' | 'publish' | null) => void
  moveView: (direction: number) => void
  run: (action: () => Promise<unknown>, after?: () => void) => Promise<void>
  planning: ItsaplanPlanningApi
}
export function ViewHeader({
  view,
  draft,
  canEdit,
  busy,
  caps,
  canRead,
  permissions,
  setOriginal,
  setDraft,
  newView,
  setConfirmation,
  moveView,
  run,
  planning
}: HeaderProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <h2 className="font-semibold">{view.name}</h2>
      {!draft && canEdit && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => (
            setOriginal(view),
            setDraft({ ...view, filters: { ...view.filters }, display: { ...view.display } })
          )}
        >
          {translate('itsaplan.planning.views.edit', 'Edit')}
        </Button>
      )}
      {!draft && (view.isPrivate ? caps.privateViews && canRead : permissions?.create === true) && (
        <Button variant="outline" disabled={busy} onClick={() => newView(view)}>
          {translate('itsaplan.planning.views.copy', 'Copy')}
        </Button>
      )}
      {!draft && (view.isPrivate ? canRead && caps.privateViews : permissions?.delete === true) && (
        <Button variant="outline" disabled={busy} onClick={() => setConfirmation('delete')}>
          {translate('itsaplan.planning.views.delete', 'Delete')}
        </Button>
      )}
      {!draft && (caps.tabOrder || permissions?.edit === true) && (
        <>
          <Button variant="outline" disabled={busy} onClick={() => moveView(-1)}>
            {translate('itsaplan.planning.views.moveEarlier', 'Move earlier')}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => moveView(1)}>
            {translate('itsaplan.planning.views.moveLater', 'Move later')}
          </Button>
        </>
      )}
      {!draft && caps.favorites && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => run(() => planning.favoriteView(view.id, !view.favorite))}
        >
          {view.favorite
            ? translate('itsaplan.planning.views.unfavorite', 'Remove favorite')
            : translate('itsaplan.planning.views.favorite', 'Favorite')}
        </Button>
      )}
      {!draft && caps.hiddenViews && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => run(() => planning.hideView(view.id, !view.hidden))}
        >
          {view.hidden
            ? translate('itsaplan.planning.views.show', 'Show')
            : translate('itsaplan.planning.views.hide', 'Hide')}
        </Button>
      )}
      {!draft && caps.publishViews && view.isPrivate && canEdit && permissions?.create === true && (
        <Button variant="outline" disabled={busy} onClick={() => setConfirmation('publish')}>
          {translate('itsaplan.planning.views.publish', 'Publish')}
        </Button>
      )}
    </div>
  )
}
