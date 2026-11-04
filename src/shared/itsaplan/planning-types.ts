export type PlanningInitiative = {
  id: number
  projectId: number
  title: string
  description: string
  status: string
  ownerUserId: string | null
  priority: string | null
  startDate: string | null
  targetDate: string | null
  position: number
  createdAt: string
  updatedAt: string
  labelIds: number[]
  progress: { completed: number; canceled: number; total: number }
  health: string | null
}
export type PlanningInitiativeInput = {
  title: string
  description?: string
  status?: 'proposed' | 'planned' | 'active' | 'completed' | 'canceled'
  ownerUserId?: string | null
  priority?: string | null
  startDate?: string | null
  targetDate?: string | null
  labelIds?: number[]
}
export type PlanningPage<T> = { items: T[]; total: number; page: number; pageSize: number }
export type PlanningListOptions = {
  page?: number
  pageSize?: number
  status?: string
  search?: string
  sort?: 'title' | 'priority' | 'targetDate' | 'owner'
  dir?: 'asc' | 'desc'
}
export type PlanningView = {
  id: number
  projectId: number
  name: string
  icon: string | null
  filters: Record<string, unknown>
  display: Record<string, unknown>
  position: number
  isPrivate?: boolean
  favorite?: boolean
  hidden?: boolean
  createdAt: string
  [key: string]: unknown
}
export type PlanningViewInput = {
  name: string
  icon?: string | null
  filters?: Record<string, unknown>
  display?: Record<string, unknown>
  isPrivate?: boolean
}
export type PlanningDashboard = {
  id: number
  projectId: number
  name: string
  icon: string | null
  layout: unknown[]
  position: number
  createdAt: string
  [key: string]: unknown
}
export type PlanningDashboardInput = { name: string; icon?: string | null; layout?: unknown[] }
export type PlanningCapabilities = {
  timeZone?: string
  privateViews: boolean
  hiddenViews: boolean
  publishViews: boolean
  tabOrder: boolean
  favorites: boolean
}
export type PlanningActivityItem = {
  id: number
  source?: string
  kind: string
  actorName: string | null
  body: string | null
  createdAt: string
  issueId?: number | null
  issueIdentifier?: string | null
  issueTitle?: string
  action?: string | null
  [key: string]: unknown
}
export type PlanningActivityPage = {
  items: PlanningActivityItem[]
  nextCursor: { ts: string; id: number } | null
}
export type PlanningAnalyticsKind =
  | 'stats'
  | 'breakdown'
  | 'pulse'
  | 'throughput'
  | 'burnup'
  | 'activity'
  | 'agent-runs'
  | 'agent-run-stats'
  | 'webhook-stats'
  | 'agent-workload'
export type PlanningAnalyticsQuery = {
  by?: 'status' | 'priority' | 'type' | 'assignee' | 'delegate'
  scope?: 'project' | 'me'
  unit?: 'hour' | 'day' | 'week'
  columns?: number
  weeks?: number
  days?: number
  initiativeId?: number
  forecastWeeks?: number
  limit?: number
  cursor?: { ts: string; id: number }
  actorUserId?: string
  action?: string
  status?: 'pending' | 'success' | 'failed'
  from?: string
  to?: string
  issueIds?: string
}
export type PlanningAnalyticsData = Record<string, unknown> | Record<string, unknown>[]
export type ItsaplanPlanningApi = {
  capabilities(): Promise<PlanningCapabilities>
  listInitiatives(
    projectRef: string,
    options?: PlanningListOptions
  ): Promise<PlanningPage<PlanningInitiative>>
  getInitiative(id: number): Promise<PlanningInitiative>
  createInitiative(projectRef: string, input: PlanningInitiativeInput): Promise<PlanningInitiative>
  updateInitiative(
    id: number,
    updates: Partial<PlanningInitiativeInput>
  ): Promise<PlanningInitiative>
  deleteInitiative(id: number): Promise<void>
  initiativeFeed(
    id: number,
    options?: { cursor?: { ts: string; id: number }; limit?: number }
  ): Promise<PlanningActivityPage>
  listViews(projectRef: string): Promise<PlanningView[]>
  createView(projectRef: string, input: PlanningViewInput): Promise<PlanningView>
  updateView(
    id: number,
    updates: Partial<Omit<PlanningViewInput, 'isPrivate'>>
  ): Promise<PlanningView>
  deleteView(id: number): Promise<void>
  favoriteView(id: number, favorite: boolean): Promise<void>
  hideView(id: number, hidden: boolean): Promise<void>
  publishView(id: number): Promise<PlanningView>
  reorderViews(projectRef: string, orderedIds: number[]): Promise<PlanningView[]>
  arrangeViewTabs(projectRef: string, orderedIds: number[]): Promise<PlanningView[]>
  listDashboards(projectRef: string): Promise<PlanningDashboard[]>
  createDashboard(projectRef: string, input: PlanningDashboardInput): Promise<PlanningDashboard>
  updateDashboard(id: number, updates: Partial<PlanningDashboardInput>): Promise<PlanningDashboard>
  deleteDashboard(id: number): Promise<void>
  reorderDashboards(projectRef: string, orderedIds: number[]): Promise<PlanningDashboard[]>
  analytics(
    projectRef: string,
    kind: PlanningAnalyticsKind,
    query?: PlanningAnalyticsQuery
  ): Promise<PlanningAnalyticsData>
}
