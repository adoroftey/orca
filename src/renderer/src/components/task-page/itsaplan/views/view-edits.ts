import type {
  PlanningView,
  ItsaplanPlanningApi,
  PlanningCapabilities,
  PlanningViewInput
} from '../../../../../../shared/itsaplan/planning-types'

type Changes = Partial<Omit<PlanningViewInput, 'isPrivate'>>

export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => jsonEqual(v, b[i]))
    )
  }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    return false
  }
  const ak = Object.keys(a).sort()
  const bk = Object.keys(b).sort()
  return (
    ak.length === bk.length &&
    ak.every((key, i) => key === bk[i] && jsonEqual(Reflect.get(a, key), Reflect.get(b, key)))
  )
}

export function buildViewChanges(original: PlanningView, draft: PlanningView): Changes {
  const changes: Changes = {}
  if (!jsonEqual(original.name, draft.name)) {
    changes.name = draft.name
  }
  if (!jsonEqual(original.icon, draft.icon)) {
    changes.icon = draft.icon
  }
  if (!jsonEqual(original.filters, draft.filters)) {
    changes.filters = draft.filters
  }
  if (!jsonEqual(original.display, draft.display)) {
    changes.display = draft.display
  }
  return changes
}

import { translate } from '@/i18n/i18n'

type SaveViewArgs = {
  original: PlanningView | null
  draft: PlanningView
  planning: ItsaplanPlanningApi
  projectRef: string
  life: { active: boolean }
  setDraft: (value: PlanningView | null) => void
  setBusy: (value: boolean) => void
  setError: (value: string) => void
  refresh: () => void
}
export async function saveView({
  original,
  draft,
  planning,
  projectRef,
  life,
  setDraft,
  setBusy,
  setError,
  refresh
}: SaveViewArgs): Promise<void> {
  if (!original) {
    return
  }
  const changes = buildViewChanges(original, draft)
  if (Object.keys(changes).length === 0) {
    setDraft(null)
    return
  }
  setBusy(true)
  setError('')
  try {
    const latest = (await planning.listViews(projectRef)).find((item) => item.id === original.id)
    if (!life.active) {
      return
    }
    const remoteChanges = latest && buildViewChanges(original, latest)
    if (!remoteChanges || Object.keys(changes).some((key) => Object.hasOwn(remoteChanges, key))) {
      setError(
        translate(
          'itsaplan.planning.views.conflict',
          'Conflict: this view changed. Reload or discard your changes.'
        )
      )
      return
    }
    await planning.updateView(original.id, changes)
    if (life.active) {
      setDraft(null)
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

export const noCapabilities: PlanningCapabilities = {
  privateViews: false,
  hiddenViews: false,
  publishViews: false,
  tabOrder: false,
  favorites: false
}
