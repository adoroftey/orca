import type {
  PlanningDashboard,
  PlanningDashboardInput
} from '../../../../../../shared/itsaplan/planning-types'
import { jsonEqual } from '../views/view-edits'

export function buildDashboardChanges(
  original: PlanningDashboard,
  draft: PlanningDashboard
): Partial<PlanningDashboardInput> {
  const changes: Partial<PlanningDashboardInput> = {}
  if (!jsonEqual(original.name, draft.name)) {
    changes.name = draft.name
  }
  if (!jsonEqual(original.icon, draft.icon)) {
    changes.icon = draft.icon
  }
  if (!jsonEqual(original.layout, draft.layout)) {
    changes.layout = draft.layout
  }
  return changes
}
