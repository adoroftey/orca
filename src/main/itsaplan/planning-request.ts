import type { z } from 'zod'
import type { ItsaplanPlanningParams } from '../../shared/rpc-contract/itsaplan-planning-params'
import { itsaplanConnection } from './connection'
export function dispatchPlanningRequest(
  params: z.infer<typeof ItsaplanPlanningParams>
): Promise<unknown> {
  const api = itsaplanConnection.forServer(params.expectedBaseUrl).planning
  if (!api) {
    throw new Error('Planning is unavailable.')
  }
  switch (params.operation) {
    case 'capabilities':
      return api.capabilities()
    case 'listInitiatives':
      return api.listInitiatives(params.args.projectRef, params.args.options)
    case 'getInitiative':
      return api.getInitiative(params.args.id)
    case 'createInitiative':
      return api.createInitiative(params.args.projectRef, params.args.input)
    case 'updateInitiative':
      return api.updateInitiative(params.args.id, params.args.updates)
    case 'deleteInitiative':
      return api.deleteInitiative(params.args.id)
    case 'initiativeFeed':
      return api.initiativeFeed(params.args.id, params.args.options)
    case 'listViews':
      return api.listViews(params.args.projectRef)
    case 'createView':
      return api.createView(params.args.projectRef, params.args.input)
    case 'updateView':
      return api.updateView(params.args.id, params.args.updates)
    case 'deleteView':
      return api.deleteView(params.args.id)
    case 'favoriteView':
      return api.favoriteView(params.args.id, params.args.favorite)
    case 'hideView':
      return api.hideView(params.args.id, params.args.hidden)
    case 'publishView':
      return api.publishView(params.args.id)
    case 'reorderViews':
      return api.reorderViews(params.args.projectRef, params.args.orderedIds)
    case 'arrangeViewTabs':
      return api.arrangeViewTabs(params.args.projectRef, params.args.orderedIds)
    case 'listDashboards':
      return api.listDashboards(params.args.projectRef)
    case 'createDashboard':
      return api.createDashboard(params.args.projectRef, params.args.input)
    case 'updateDashboard':
      return api.updateDashboard(params.args.id, params.args.updates)
    case 'deleteDashboard':
      return api.deleteDashboard(params.args.id)
    case 'reorderDashboards':
      return api.reorderDashboards(params.args.projectRef, params.args.orderedIds)
    case 'analytics':
      return api.analytics(params.args.projectRef, params.args.kind, params.args.query)
  }
}
