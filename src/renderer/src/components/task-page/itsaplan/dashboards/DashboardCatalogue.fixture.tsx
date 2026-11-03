import { defineFixture } from '@/component-fixtures/component-fixture'
import type {
  ItsaplanPlanningApi,
  PlanningAnalyticsData,
  PlanningAnalyticsKind
} from '../../../../../../shared/itsaplan/planning-types'
import type {
  ItsaplanApi,
  ItsaplanIssue,
  ItsaplanProject,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'

const unavailable = (): never => {
  throw new Error('Unavailable in fixture')
}
const project: ItsaplanProject = {
  id: 1,
  key: 'REL',
  ref: 'release',
  name: 'Release readiness',
  initiativesEnabled: true,
  dashboardsEnabled: true,
  cyclesEnabled: true,
  subtasksEnabled: true,
  pointsEstimateEnabled: true,
  timeEstimateEnabled: true,
  timeLoggingEnabled: true
}
const metadata: ItsaplanProjectDetails = {
  project,
  columns: [
    { id: 1, name: 'Backlog', stateType: 'unstarted', color: '#94a3b8', position: 0 },
    { id: 2, name: 'In progress', stateType: 'started', color: '#3b82f6', position: 1 },
    { id: 3, name: 'Done', stateType: 'completed', color: '#22c55e', position: 2 }
  ],
  assignees: [
    { userId: 'maya', name: 'Maya Chen', kind: 'member' },
    { userId: 'alex', name: 'Alex Morgan', kind: 'member' }
  ],
  issueTypes: [
    { id: 1, name: 'Task' },
    { id: 2, name: 'Bug' }
  ],
  labels: [
    { id: 1, name: 'Release', color: '#8b5cf6' },
    { id: 2, name: 'Platform', color: '#06b6d4' }
  ],
  customFields: [],
  viewer: { role: 'admin' },
  permissions: {
    views: { read: true, create: true, edit: true, delete: true },
    work_items: { read: true, edit: true }
  }
}
const issues: ItsaplanIssue[] = [
  'Finalize release checklist',
  'Test payment retry flow',
  'Publish migration guide',
  'Resolve dashboard loading regression',
  'Review observability alerts',
  'Prepare rollout announcement'
].map((title, index) => ({
  id: index + 1,
  projectId: 1,
  sequenceNumber: index + 101,
  identifier: `REL-${index + 101}`,
  title,
  description: 'Release readiness work',
  columnId: (index % 3) + 1,
  assigneeUserId: index % 2 ? 'alex' : 'maya',
  priority: index % 2 ? 'high' : 'medium',
  typeId: index === 3 ? 2 : 1,
  labelIds: [1],
  startDate: `2026-11-${String(2 + index).padStart(2, '0')}`,
  dueDate: `2026-11-${String(10 + index).padStart(2, '0')}`,
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-11-02T10:00:00Z'
}))
const api: ItsaplanApi = {
  listProjects: unavailable,
  getProject: unavailable,
  listIssues: async () => issues,
  searchIssues: unavailable,
  getIssue: unavailable,
  createIssue: unavailable,
  updateIssue: unavailable,
  listComments: unavailable,
  addComment: unavailable,
  status: unavailable,
  connect: unavailable,
  disconnect: unavailable
}
const planningBase: ItsaplanPlanningApi = {
  capabilities: async () => ({
    privateViews: true,
    hiddenViews: true,
    publishViews: true,
    tabOrder: true,
    favorites: true
  }),
  listInitiatives: unavailable,
  getInitiative: unavailable,
  createInitiative: unavailable,
  updateInitiative: unavailable,
  deleteInitiative: unavailable,
  initiativeFeed: unavailable,
  listViews: unavailable,
  createView: unavailable,
  updateView: unavailable,
  deleteView: unavailable,
  favoriteView: unavailable,
  hideView: unavailable,
  publishView: unavailable,
  reorderViews: unavailable,
  arrangeViewTabs: unavailable,
  listDashboards: unavailable,
  createDashboard: unavailable,
  updateDashboard: unavailable,
  deleteDashboard: unavailable,
  reorderDashboards: unavailable,
  analytics: unavailable
}

import { DashboardGrid } from './DashboardGrid'

const data: Record<PlanningAnalyticsKind, PlanningAnalyticsData> = {
  stats: { total: 42, completed: 18, started: 14 },
  breakdown: [
    { label: 'Backlog', count: 10 },
    { label: 'In progress', count: 14 },
    { label: 'Done', count: 18 }
  ],
  pulse: [
    { label: 'Mon', count: 5 },
    { label: 'Tue', count: 12 },
    { label: 'Wed', count: 8 },
    { label: 'Thu', count: 15 },
    { label: 'Fri', count: 7 }
  ],
  throughput: [
    { week: '2026-10-05', created: 8, closed: 5 },
    { week: '2026-10-12', created: 7, closed: 9 },
    { week: '2026-10-19', created: 6, closed: 10 }
  ],
  burnup: {
    days: [
      { date: '2026-10-01', scope: 30, started: 8, completed: 3 },
      { date: '2026-10-15', scope: 36, started: 20, completed: 12 },
      { date: '2026-11-01', scope: 42, started: 32, completed: 24 }
    ],
    forecast: {
      projectedDate: '2026-11-20',
      optimisticDate: '2026-11-16',
      pessimisticDate: '2026-11-26',
      projectedScope: 42,
      remaining: 18,
      velocityPerDay: 1.2
    },
    targetDate: '2026-11-27'
  },
  activity: {
    items: [
      {
        id: 1,
        actorName: 'Maya Chen',
        body: 'completed release checklist',
        issueId: 1,
        issueIdentifier: 'REL-101',
        createdAt: '2026-11-02T10:00:00Z'
      },
      {
        id: 2,
        actorName: 'Alex Morgan',
        body: 'updated rollout plan',
        issueId: 2,
        issueIdentifier: 'REL-102',
        createdAt: '2026-11-01T10:00:00Z'
      }
    ],
    nextCursor: null
  },
  'agent-runs': [
    {
      id: 1,
      agentName: 'Release assistant',
      status: 'success',
      issueId: 1,
      issueIdentifier: 'REL-101',
      createdAt: '2026-11-02T10:00:00Z'
    }
  ],
  'agent-run-stats': { total: 42, success: 38, failed: 2, pending: 2 },
  'webhook-stats': {
    total: 128,
    success: 122,
    failed: 4,
    pending: 2,
    activeWebhooks: 3,
    disabledWebhooks: 1
  },
  'agent-workload': [
    {
      agentId: 1,
      agentName: 'Release assistant',
      delegatedOpen: 4,
      runsTotal: 42,
      runsSuccess: 38,
      runsFailed: 2
    }
  ]
}
const planning: ItsaplanPlanningApi = {
  ...planningBase,
  analytics: async (_ref, kind) => data[kind]
}
const layout = [
  'stat',
  'recent_issues',
  'activity_feed',
  'pulse',
  'throughput',
  'burnup',
  'breakdown',
  'agent_runs',
  'agent_health',
  'webhook_health',
  'agent_workload',
  'future_widget'
].map((type, i) => ({
  id: `widget-${i}`,
  type,
  config: type === 'burnup' ? { forecast: 'range' } : {}
}))
function catalogue(width: number) {
  return defineFixture({
    width,
    render: () => (
      <DashboardGrid
        layout={layout}
        api={api}
        planning={planning}
        project={project}
        metadata={metadata}
        issues={issues}
        onOpenIssue={() => {}}
      />
    )
  })
}
export const desktop = catalogue(1200)
export const narrow = catalogue(390)
