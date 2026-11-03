export type ItsaplanProject = {
  id: number
  key: string
  ref: string
  name: string
  teamName?: string | null
  archivedAt?: string | null
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
  viewer?: { role?: string }
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

export const ITSAPLAN_RUNTIME_CAPABILITY = 'itsaplan.tasks.v1' as const
export const ITSAPLAN_UPDATE_REQUIRED = 'Update Orca on this host to use Itsaplan Tasks.'
