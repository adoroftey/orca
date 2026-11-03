import { defineFixture } from '../../../../component-fixtures/component-fixture'
import type { ItsaplanApi, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
import type { ItsaplanPlanningApi } from '../../../../../../shared/itsaplan/planning-types'
import { ItsaplanInitiativesPanel } from './InitiativesPanel'

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
const project = { id: 1, key: 'APP', ref: 'team.APP', name: 'Application' }
const metadata: ItsaplanProjectDetails = {
  project,
  columns: [],
  assignees: [{ userId: 'alex', name: 'Alex', kind: 'member' }],
  permissions: { initiatives: { read: true, create: true, edit: true, delete: true } }
}
const initiative = {
  id: 1,
  projectId: 1,
  title: 'Improve checkout',
  description: 'Make checkout faster and easier.',
  status: 'active',
  ownerUserId: 'alex',
  priority: 'high',
  startDate: '2026-10-01',
  targetDate: '2026-12-01',
  position: 0,
  createdAt: '',
  updatedAt: '',
  labelIds: [],
  progress: { completed: 3, canceled: 1, total: 8 },
  health: 'on_track'
}
const planning = fixturePlanning({
  listInitiatives: async () => ({ items: [initiative], total: 1, page: 1, pageSize: 20 }),
  getInitiative: async () => initiative,
  initiativeFeed: async () => ({ items: [], nextCursor: null })
})
const api = fixtureApi({ listIssues: async () => [] })
function Fixture() {
  return (
    <div className="bg-background p-4">
      <ItsaplanInitiativesPanel
        api={api}
        planning={planning}
        project={project}
        metadata={metadata}
        onOpenIssue={() => {}}
      />
    </div>
  )
}
async function waitForButton(frame: HTMLElement) {
  for (let n = 0; n < 100; n++) {
    const button = [...frame.querySelectorAll('button')].find(
      (el) => el.textContent === initiative.title
    )
    if (button) {
      return button
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('Initiative did not load')
}
export const list = defineFixture({
  width: 1100,
  render: () => <Fixture />,
  interact: async (frame) => {
    await waitForButton(frame)
  }
})
export const detail = defineFixture({
  width: 1100,
  render: () => <Fixture />,
  interact: async (frame) => {
    ;(await waitForButton(frame)).click()
  }
})
export const narrow = defineFixture({ ...detail, width: 390 })
