import type { ItsaplanPlanningApi } from '../../shared/itsaplan/planning-types'

export function createPlanningFacade(get: () => ItsaplanPlanningApi): ItsaplanPlanningApi {
  return {
    capabilities: () => get().capabilities(),
    listInitiatives: (projectRef, options) => get().listInitiatives(projectRef, options),
    getInitiative: (id) => get().getInitiative(id),
    createInitiative: (projectRef, input) => get().createInitiative(projectRef, input),
    updateInitiative: (id, updates) => get().updateInitiative(id, updates),
    deleteInitiative: (id) => get().deleteInitiative(id),
    initiativeFeed: (id, options) => get().initiativeFeed(id, options),
    listViews: (projectRef) => get().listViews(projectRef),
    createView: (projectRef, input) => get().createView(projectRef, input),
    updateView: (id, updates) => get().updateView(id, updates),
    deleteView: (id) => get().deleteView(id),
    favoriteView: (id, favorite) => get().favoriteView(id, favorite),
    hideView: (id, hidden) => get().hideView(id, hidden),
    publishView: (id) => get().publishView(id),
    reorderViews: (projectRef, orderedIds) => get().reorderViews(projectRef, orderedIds),
    arrangeViewTabs: (projectRef, orderedIds) => get().arrangeViewTabs(projectRef, orderedIds),
    listDashboards: (projectRef) => get().listDashboards(projectRef),
    createDashboard: (projectRef, input) => get().createDashboard(projectRef, input),
    updateDashboard: (id, updates) => get().updateDashboard(id, updates),
    deleteDashboard: (id) => get().deleteDashboard(id),
    reorderDashboards: (projectRef, orderedIds) => get().reorderDashboards(projectRef, orderedIds),
    analytics: (projectRef, kind, query) => get().analytics(projectRef, kind, query)
  }
}
