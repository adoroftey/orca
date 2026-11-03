import { useState } from 'react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import type { ItsaplanApi, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
import type {
  ItsaplanPlanningApi,
  PlanningDashboard
} from '../../../../../../shared/itsaplan/planning-types'
import { DashboardEditor } from './DashboardEditor'
import { DashboardGrid } from './DashboardGrid'

const project = {
  id: 1,
  key: 'ORCA',
  ref: 'engineering.ORCA',
  name: 'Orca',
  dashboardsEnabled: true
}
const metadata: ItsaplanProjectDetails = {
  project,
  columns: [],
  assignees: [],
  permissions: { dashboards: { read: true, edit: true } }
}
const dashboard: PlanningDashboard = {
  id: 1,
  projectId: 1,
  name: 'Project overview',
  icon: null,
  position: 0,
  createdAt: '',
  layout: [
    {
      id: 'stat',
      type: 'stat',
      title: 'Open work',
      x: 0,
      y: 0,
      w: 6,
      h: 1,
      config: { filters: {} }
    },
    {
      id: 'future',
      type: 'future_chart',
      title: 'Future chart',
      x: 6,
      y: 0,
      w: 6,
      h: 2,
      config: { futureOption: { enabled: true } },
      futureField: 'preserved'
    },
    'unknown entry'
  ]
}
const unavailable = async (): Promise<never> => {
  throw new Error('Unexpected API call')
}
export function makeApi(overrides: Partial<ItsaplanApi> = {}): ItsaplanApi {
  return {
    listProjects: unavailable,
    getProject: unavailable,
    listIssues: unavailable,
    searchIssues: unavailable,
    getIssue: unavailable,
    createIssue: unavailable,
    updateIssue: unavailable,
    listComments: unavailable,
    addComment: unavailable,
    status: unavailable,
    connect: unavailable,
    disconnect: unavailable,
    ...overrides
  }
}
export function makePlanning(overrides: Partial<ItsaplanPlanningApi> = {}): ItsaplanPlanningApi {
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
const api = makeApi()
const planning = makePlanning()
function Fixture({ editing }: { editing: boolean }) {
  const [draft, setDraft] = useState(dashboard)
  return (
    <div className="bg-background p-4">
      {editing ? (
        <DashboardEditor
          value={draft}
          metadata={metadata}
          planning={planning}
          project={project}
          disabled={false}
          onChange={setDraft}
        />
      ) : (
        <DashboardGrid
          layout={dashboard.layout}
          metadata={metadata}
          planning={planning}
          api={api}
          project={project}
          issues={[]}
          onOpenIssue={() => {}}
        />
      )}
    </div>
  )
}
export const normal = defineFixture({ width: 1100, render: () => <Fixture editing={false} /> })
export const editor = defineFixture({ width: 1100, render: () => <Fixture editing /> })
export const narrow = defineFixture({ width: 390, render: () => <Fixture editing={false} /> })
