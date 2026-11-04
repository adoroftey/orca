import type { ItsaplanApi } from '../../../../../shared/itsaplan/types'
import type { ItsaplanPlanningApi } from '../../../../../shared/itsaplan/planning-types'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { PlanningShell } from './PlanningShell'

const unavailable = async (): Promise<never> => {
  throw new Error('Unexpected fixture API call')
}
function fixturePlanning(overrides: Partial<ItsaplanPlanningApi> = {}): ItsaplanPlanningApi {
  return {
    capabilities: unavailable,
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
    analytics: unavailable,
    ...overrides
  }
}
function fixtureApi(overrides: Partial<ItsaplanApi> = {}): ItsaplanApi {
  return {
    status: unavailable,
    connect: unavailable,
    disconnect: unavailable,
    listProjects: unavailable,
    getProject: unavailable,
    listIssues: unavailable,
    searchIssues: unavailable,
    getIssue: unavailable,
    createIssue: unavailable,
    updateIssue: unavailable,
    listComments: unavailable,
    addComment: unavailable,
    ...overrides
  }
}
const project = { id: 1, key: 'ORCA', ref: 'engineering.ORCA', name: 'Orca integration' }
const connection = {
  connected: true,
  baseUrl: 'https://api.plan.example',
  webBaseUrl: 'https://plan.example'
}
const metadata = {
  project,
  columns: [],
  assignees: [],
  permissions: { initiatives: { read: true }, views: { read: true }, dashboards: { read: true } }
}
const date = '2026-11-03T00:00:00Z'
const planning = fixturePlanning({
  listInitiatives: async () => ({
    items: [
      {
        id: 1,
        projectId: 1,
        title: 'Native integration',
        description: 'Planning work',
        status: 'active',
        ownerUserId: null,
        priority: null,
        startDate: null,
        targetDate: null,
        position: 0,
        createdAt: date,
        updatedAt: date,
        labelIds: [],
        progress: { completed: 1, canceled: 0, total: 3 },
        health: null
      }
    ],
    total: 1,
    page: 1,
    pageSize: 20
  }),
  listViews: async () => [
    {
      id: 1,
      projectId: 1,
      name: 'Team work',
      icon: null,
      filters: {},
      display: {},
      position: 0,
      createdAt: date
    }
  ],
  listDashboards: async () => [
    {
      id: 1,
      projectId: 1,
      name: 'Project overview',
      icon: null,
      layout: [],
      position: 0,
      createdAt: date
    }
  ],
  capabilities: async () => ({
    privateViews: false,
    hiddenViews: false,
    publishViews: false,
    tabOrder: false,
    favorites: false
  })
})
const api = fixtureApi({ planning, getProject: async () => metadata, listIssues: async () => [] })
function Fixture({ section }: { section: 'initiatives' | 'views' | 'dashboards' }) {
  return (
    <div className="flex h-160 flex-col bg-background">
      <PlanningShell
        api={api}
        connection={connection}
        project={project}
        onUseIssue={() => {}}
        initialSection={section}
      />
    </div>
  )
}
export const initiatives = defineFixture({
  width: 1100,
  render: () => <Fixture section="initiatives" />
})
export const views = defineFixture({ width: 1100, render: () => <Fixture section="views" /> })
export const dashboards = defineFixture({
  width: 1100,
  render: () => <Fixture section="dashboards" />
})
export const narrow = defineFixture({ width: 390, render: () => <Fixture section="initiatives" /> })
