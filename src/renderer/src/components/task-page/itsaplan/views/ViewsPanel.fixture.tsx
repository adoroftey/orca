import { defineFixture } from '@/component-fixtures/component-fixture'
import type {
  ItsaplanApi,
  ItsaplanIssue,
  ItsaplanProject,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import type {
  ItsaplanPlanningApi,
  PlanningView
} from '../../../../../../shared/itsaplan/planning-types'
import { ItsaplanViewsPanel } from './ViewsPanel'

const unavailable = (): never => {
  throw new Error('Unavailable in fixture')
}
export const project: ItsaplanProject = {
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
export const metadata: ItsaplanProjectDetails = {
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
export const issues: ItsaplanIssue[] = [
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
export const api: ItsaplanApi = {
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
export const planningBase: ItsaplanPlanningApi = {
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
function fixture(layout: string, width = 1200, edit = false, unsupported = false) {
  const view: PlanningView = {
    id: 1,
    projectId: 1,
    name: 'Release work',
    icon: null,
    filters: unsupported ? { futureFilter: 'value' } : {},
    display: { layout },
    position: 0,
    createdAt: '2026-10-20T10:00:00Z'
  }
  const planning: ItsaplanPlanningApi = { ...planningBase, listViews: async () => [view] }
  const click = (frame: HTMLElement, label: string) =>
    new Promise<void>((resolve, reject) => {
      const started = performance.now()
      const find = () => {
        const button = [...frame.querySelectorAll('button')].find(
          (item) => item.getAttribute('aria-label') === label || item.textContent?.trim() === label
        )
        if (button) {
          button.click()
          resolve()
          return
        }
        if (performance.now() - started > 5000) {
          reject(new Error(`Button not found: ${label}`))
          return
        }
        requestAnimationFrame(find)
      }
      find()
    })
  return defineFixture({
    width,
    render: () => (
      <ItsaplanViewsPanel
        api={api}
        planning={planning}
        project={project}
        metadata={metadata}
        onOpenIssue={() => {}}
      />
    ),
    interact: async (frame) => {
      await click(frame, 'Release work')
      if (edit) {
        await click(frame, 'Edit')
      }
    }
  })
}
export const table = fixture('table')
export const kanban = fixture('kanban')
export const calendar = fixture('calendar')
export const timeline = fixture('timeline')
export const editor = fixture('table', 1200, true)
export const narrow = fixture('kanban', 390)
export const unsupportedFilter = fixture('table', 1200, false, true)
