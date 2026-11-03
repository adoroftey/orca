import { analyticsKeys, analyticsSchemas } from './planning-analytics'
import { z, type ZodType } from 'zod'
import type { ItsaplanPlanningApi } from '../../shared/itsaplan/planning-types'
import { ItsaplanId, ItsaplanProjectRef } from '../../shared/itsaplan/schemas'
import {
  ActivityPageSchema,
  AnalyticsKindSchema,
  AnalyticsQuerySchema,
  DashboardInputSchema,
  DashboardSchema,
  FeedOptionsSchema,
  InitiativeInputSchema,
  InitiativeSchema,
  ListOptionsSchema,
  ViewInputSchema,
  ViewSchema
} from '../../shared/itsaplan/planning-schemas'

type Request = <T>(path: string, schema: ZodType<T>, method?: string, body?: unknown) => Promise<T>
type Validate = <T>(schema: ZodType<T>, value: unknown) => T
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function supportsPrivateCreate(schema: unknown, components: unknown): boolean {
  const seen = new Set<string>()
  while (isRecord(schema)) {
    if (typeof schema.$ref !== 'string') {
      return isRecord(schema.properties) && schema.properties.isPrivate !== undefined
    }
    const match = /^#\/components\/schemas\/([^/]+)$/.exec(schema.$ref)
    if (!match || seen.has(schema.$ref) || !isRecord(components) || !isRecord(components.schemas)) {
      return false
    }
    seen.add(schema.$ref)
    schema = components.schemas[match[1]]
  }
  return false
}
export function createPlanningClient(request: Request, valid: Validate): ItsaplanPlanningApi {
  const project = (ref: string) => `/projects/${encodeURIComponent(valid(ItsaplanProjectRef, ref))}`
  const item = (kind: string, id: number) => `/${kind}/${valid(ItsaplanId, id)}`
  const query = (values: Record<string, unknown>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined) {
        p.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
      }
    }
    const s = p.toString()
    return s ? `?${s}` : ''
  }
  const ids = (orderedIds: number[]) => ({ orderedIds: valid(z.array(ItsaplanId), orderedIds) })
  const voidSchema = z.undefined()
  const capabilities = async () => {
    const timeZone = await request('/account/preferences', z.object({ timezone: z.string() }))
      .then(({ timezone }) => {
        if (!timezone) {
          return undefined
        }
        try {
          new Intl.DateTimeFormat('en', { timeZone: timezone })
          return timezone
        } catch {
          return undefined
        }
      })
      .catch(() => undefined)
    try {
      const doc = await request(
        '/docs/json',
        z
          .object({
            paths: z.record(z.string(), z.unknown()),
            components: z.unknown().optional()
          })
          .passthrough()
      )
      const paths = doc.paths
      const createPath = Object.entries(paths).find(([key]) =>
        /\/projects\/\{[^}]+\}\/views$/.test(key)
      )?.[1]
      const post = isRecord(createPath) ? createPath.post : undefined
      const body = isRecord(post) ? post.requestBody : undefined
      const content = isRecord(body) ? body.content : undefined
      const json = isRecord(content) ? content['application/json'] : undefined
      const schema = isRecord(json) ? json.schema : undefined
      const privateViews = supportsPrivateCreate(schema, doc.components)
      return {
        ...(timeZone ? { timeZone } : {}),
        privateViews: Boolean(privateViews),
        hiddenViews: Object.keys(paths).some((k) => /\/views\/\{[^}]+\}\/hidden$/.test(k)),
        publishViews: Object.keys(paths).some((k) => /\/views\/\{[^}]+\}\/publish$/.test(k)),
        tabOrder: Object.keys(paths).some((k) => k.endsWith('/views/tab-row')),
        favorites: Object.keys(paths).some((k) => /\/views\/\{[^}]+\}\/favorite$/.test(k))
      }
    } catch {
      return {
        ...(timeZone ? { timeZone } : {}),
        privateViews: false,
        hiddenViews: false,
        publishViews: false,
        tabOrder: false,
        favorites: false
      }
    }
  }
  return {
    capabilities,
    listInitiatives: (ref, options = {}) =>
      request(
        `${project(ref)}/initiatives${query(valid(ListOptionsSchema, options))}`,
        z
          .object({
            items: z.array(InitiativeSchema),
            total: z.number(),
            page: z.number(),
            pageSize: z.number()
          })
          .passthrough()
      ),
    getInitiative: (id) => request(item('initiatives', id), InitiativeSchema),
    createInitiative: (ref, input) =>
      request(
        `${project(ref)}/initiatives`,
        InitiativeSchema,
        'POST',
        valid(InitiativeInputSchema, input)
      ),
    updateInitiative: (id, updates) =>
      request(
        item('initiatives', id),
        InitiativeSchema,
        'PATCH',
        valid(InitiativeInputSchema.partial(), updates)
      ),
    deleteInitiative: (id) => request(item('initiatives', id), voidSchema, 'DELETE'),
    initiativeFeed: (id, options = {}) =>
      request(
        `${item('initiatives', id)}/feed${query(valid(FeedOptionsSchema, options))}`,
        ActivityPageSchema
      ),
    listViews: (ref) => request(`${project(ref)}/views`, z.array(ViewSchema)),
    createView: async (ref, input) => {
      const parsed = valid(ViewInputSchema, input)
      if (parsed.isPrivate && !(await capabilities()).privateViews) {
        throw new Error('Private View creation is unsupported by this Itsaplan server.')
      }
      return request(`${project(ref)}/views`, ViewSchema, 'POST', parsed)
    },
    updateView: (id, updates) =>
      request(
        item('views', id),
        ViewSchema,
        'PATCH',
        valid(ViewInputSchema.omit({ isPrivate: true }).partial(), updates)
      ),
    deleteView: (id) => request(item('views', id), voidSchema, 'DELETE'),
    favoriteView: (id, favorite) =>
      request(`${item('views', id)}/favorite`, voidSchema, favorite ? 'PUT' : 'DELETE'),
    hideView: (id, hidden) =>
      request(`${item('views', id)}/hidden`, voidSchema, hidden ? 'PUT' : 'DELETE'),
    publishView: (id) => request(`${item('views', id)}/publish`, ViewSchema, 'POST'),
    reorderViews: (ref, orderedIds) =>
      request(`${project(ref)}/views/reorder`, z.array(ViewSchema), 'PUT', ids(orderedIds)),
    arrangeViewTabs: (ref, orderedIds) =>
      request(`${project(ref)}/views/tab-row`, z.array(ViewSchema), 'PUT', ids(orderedIds)),
    listDashboards: (ref) => request(`${project(ref)}/dashboards`, z.array(DashboardSchema)),
    createDashboard: (ref, input) =>
      request(
        `${project(ref)}/dashboards`,
        DashboardSchema,
        'POST',
        valid(DashboardInputSchema, input)
      ),
    updateDashboard: (id, updates) =>
      request(
        item('dashboards', id),
        DashboardSchema,
        'PATCH',
        valid(DashboardInputSchema.partial(), updates)
      ),
    deleteDashboard: (id) => request(item('dashboards', id), voidSchema, 'DELETE'),
    reorderDashboards: (ref, orderedIds) =>
      request(
        `${project(ref)}/dashboards/reorder`,
        z.array(DashboardSchema),
        'PUT',
        ids(orderedIds)
      ),
    analytics: (ref, kind, options = {}) => {
      const parsedKind = valid(AnalyticsKindSchema, kind)
      const parsed = valid(AnalyticsQuerySchema, options)
      if (Object.keys(parsed).some((key) => !analyticsKeys[parsedKind].includes(key))) {
        throw new Error('Invalid Itsaplan request parameters.')
      }
      return request(
        `${project(ref)}/analytics/${parsedKind}${query(parsed)}`,
        analyticsSchemas[parsedKind]
      )
    }
  }
}
