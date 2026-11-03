import type { ItsaplanPlanningApi } from './planning-types'

export type ItsaplanProject = {
  id: number
  key: string
  ref: string
  name: string
  teamName?: string | null
  archivedAt?: string | null
  initiativesEnabled?: boolean
  dashboardsEnabled?: boolean
  cyclesEnabled?: boolean
  subtasksEnabled?: boolean
  pointsEstimateEnabled?: boolean
  timeEstimateEnabled?: boolean
  timeLoggingEnabled?: boolean
  availableFeatures?: string[]
}

export type ItsaplanColumn = {
  id: number
  name: string
  stateType: string
  color: string
  position: number
}

export type ItsaplanAssignee = {
  userId: string
  name: string
  email?: string
  username?: string | null
  kind: 'member' | 'agent'
}

export type ItsaplanProjectDetails = {
  project: ItsaplanProject
  columns: ItsaplanColumn[]
  assignees: ItsaplanAssignee[]
  issueTypes?: { id: number; name: string; icon?: string; color?: string; [key: string]: unknown }[]
  labels?: { id: number; name: string; color?: string; [key: string]: unknown }[]
  labelGroups?: { id: number; name: string; [key: string]: unknown }[]
  customFields?: { id: number; name: string; [key: string]: unknown }[]
  viewer?: { role?: string; timeZone?: string }
  permissions?: Record<string, Record<string, boolean>>
}

export type ItsaplanIssueSummary = {
  id: number
  sequenceNumber: number
  identifier: string
  title: string
  columnId: number
  assigneeUserId: string | null
  priority: string | null
  archived?: boolean
  typeId?: number | null
  initiativeId?: number | null
  initiative?: { id: number; title: string; status: string } | null
  cycle?: { id: number; name?: string; status: string } | null
  cycleId?: number | null
  delegateUserId?: string | null
  parentId?: number | null
  labelIds?: number[]
  fieldValues?: { fieldId: number; value: unknown; valueEnd?: string | null; optionIds: number[] }[]
  startDate?: string | null
  dueDate?: string | null
  completedAt?: string | null
  statusSince?: string | null
  archivedAt?: string | null
  estimatePoints?: number | null
  estimateMinutes?: number | null
  loggedMinutes?: number | null
}

export type ItsaplanIssue = ItsaplanIssueSummary & {
  projectId: number
  description: string
  createdAt: string
  updatedAt: string
}

export type ItsaplanIssueCreate = {
  title: string
  columnId: number
  description?: string
  assigneeUserId?: string | null
  priority?: string | null
  initiativeId?: number | null
  typeId?: number | null
  parentId?: number | null
  delegateUserId?: string | null
  cycleId?: number | null
  startDate?: string | null
  dueDate?: string | null
  labelIds?: number[]
  estimatePoints?: number | null
  estimateMinutes?: number | null
}

export type ItsaplanIssueUpdate = Partial<ItsaplanIssueCreate>

export type ItsaplanComment = {
  id: number
  issueId: number
  kind: string
  replyToId: number | null
  actorName: string | null
  body: string | null
  createdAt: string
}

export type ItsaplanCommentCursor = { ts: string; id: number }
export type ItsaplanCommentOptions = { cursor?: ItsaplanCommentCursor; limit?: number }
export type ItsaplanCommentPage = {
  items: ItsaplanComment[]
  nextCursor: ItsaplanCommentCursor | null
}

export type ItsaplanConnectionStatus = {
  connected: boolean
  baseUrl: string | null
  webBaseUrl: string | null
}

export type ItsaplanConnectArgs = { baseUrl: string; webBaseUrl?: string; apiKey: string }

export type ItsaplanRestApi = {
  planning?: ItsaplanPlanningApi
  listProjects(): Promise<ItsaplanProject[]>
  getProject(projectRef: string): Promise<ItsaplanProjectDetails>
  listIssues(projectRef: string): Promise<ItsaplanIssue[]>
  searchIssues(projectRef: string, query: string, limit?: number): Promise<ItsaplanIssueSummary[]>
  getIssue(issueId: number): Promise<ItsaplanIssue>
  createIssue(projectRef: string, input: ItsaplanIssueCreate): Promise<ItsaplanIssue>
  updateIssue(issueId: number, updates: ItsaplanIssueUpdate): Promise<ItsaplanIssue>
  listComments(issueId: number, options?: ItsaplanCommentOptions): Promise<ItsaplanCommentPage>
  addComment(issueId: number, body: string): Promise<ItsaplanComment>
}

export type ItsaplanApi = ItsaplanRestApi & {
  status(): Promise<ItsaplanConnectionStatus>
  connect(args: ItsaplanConnectArgs): Promise<ItsaplanConnectionStatus>
  disconnect(): Promise<void>
}

export const ITSAPLAN_PLANNING_RUNTIME_CAPABILITY = 'itsaplan.planning.v1' as const
export const ITSAPLAN_RUNTIME_CAPABILITY = 'itsaplan.tasks.v1' as const
export const ITSAPLAN_UPDATE_REQUIRED = 'Update Orca on this host to use Itsaplan Tasks.'
