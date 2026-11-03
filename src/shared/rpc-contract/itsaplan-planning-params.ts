import { z } from 'zod'
import { ItsaplanId, ItsaplanProjectRef } from '../itsaplan/schemas'
import {
  AnalyticsKindSchema,
  AnalyticsQuerySchema,
  DashboardInputSchema,
  FeedOptionsSchema,
  InitiativeInputSchema,
  ListOptionsSchema,
  ViewInputSchema
} from '../itsaplan/planning-schemas'
const ref = { projectRef: ItsaplanProjectRef }
const id = { id: ItsaplanId }
const ordered = { ...ref, orderedIds: z.array(ItsaplanId) }
const op = <T extends string, S extends z.ZodRawShape>(name: T, args: S) =>
  z
    .object({
      expectedBaseUrl: z.string().min(1).max(2048),
      operation: z.literal(name),
      args: z.object(args).strict()
    })
    .strict()
const operations = z.discriminatedUnion('operation', [
  op('capabilities', {}),
  op('listInitiatives', { ...ref, options: ListOptionsSchema.optional() }),
  op('getInitiative', id),
  op('createInitiative', { ...ref, input: InitiativeInputSchema }),
  op('updateInitiative', { ...id, updates: InitiativeInputSchema.partial() }),
  op('deleteInitiative', id),
  op('initiativeFeed', { ...id, options: FeedOptionsSchema.optional() }),
  op('listViews', ref),
  op('createView', { ...ref, input: ViewInputSchema }),
  op('updateView', { ...id, updates: ViewInputSchema.omit({ isPrivate: true }).partial() }),
  op('deleteView', id),
  op('favoriteView', { ...id, favorite: z.boolean() }),
  op('hideView', { ...id, hidden: z.boolean() }),
  op('publishView', id),
  op('reorderViews', ordered),
  op('arrangeViewTabs', ordered),
  op('listDashboards', ref),
  op('createDashboard', { ...ref, input: DashboardInputSchema }),
  op('updateDashboard', { ...id, updates: DashboardInputSchema.partial() }),
  op('deleteDashboard', id),
  op('reorderDashboards', ordered),
  op('analytics', { ...ref, kind: AnalyticsKindSchema, query: AnalyticsQuerySchema.optional() })
])
export const ItsaplanPlanningParams = operations
