// @vitest-environment happy-dom
import type { ItsaplanApi } from '../../../../../shared/itsaplan/types'
import type { ItsaplanPlanningApi } from '../../../../../shared/itsaplan/planning-types'
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PlanningShell } from './PlanningShell'
vi.mock('./ProjectTasks', () => ({ ItsaplanProjectTasks: () => <div>Issues content</div> }))
vi.mock('./initiatives/InitiativesPanel', () => ({
  ItsaplanInitiativesPanel: ({ onOpenIssue }: { onOpenIssue: (id: number) => void }) => (
    <div>
      <input aria-label="Selected initiative" />
      <button onClick={() => onOpenIssue(42)}>Open linked issue</button>
    </div>
  )
}))
vi.mock('./views/ViewsPanel', () => ({
  ItsaplanViewsPanel: ({ metadata }: { metadata: { viewer?: { timeZone?: string } } }) => (
    <>
      <input aria-label="Draft" />
      <span>{metadata.viewer?.timeZone}</span>
    </>
  )
}))
vi.mock('./dashboards/DashboardsPanel', () => ({
  ItsaplanDashboardsPanel: () => <div>Dashboards content</div>
}))
vi.mock('./IssueDetails', () => ({
  ItsaplanIssueDetails: ({ onBack }: { onBack: () => void }) => (
    <button onClick={onBack}>Back to panel</button>
  )
}))
afterEach(cleanup)
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
const project = { id: 1, key: 'A', ref: 'a', name: 'A' }
const connection = { connected: true, baseUrl: 'https://api.test', webBaseUrl: null }
const metadata = {
  project,
  columns: [],
  assignees: [],
  permissions: { initiatives: { read: true }, views: { read: true }, dashboards: { read: true } }
}
const api = fixtureApi({
  planning: fixturePlanning(),
  getProject: vi.fn().mockResolvedValue(metadata)
})
it('preserves panel state across section switches and issue detail return', async () => {
  render(<PlanningShell api={api} project={project} connection={connection} onUseIssue={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Views' }))
  fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'unsaved' } })
  fireEvent.click(screen.getByRole('button', { name: 'Initiatives' }))
  fireEvent.change(screen.getByLabelText('Selected initiative'), { target: { value: 'First' } })
  fireEvent.click(screen.getByRole('button', { name: 'Open linked issue' }))
  expect(screen.getByRole('navigation', { hidden: true })).toHaveStyle({ display: 'none' })
  fireEvent.click(screen.getByRole('button', { name: 'Back to panel' }))
  expect(screen.getByRole('button', { name: 'Open linked issue' })).toBeVisible()
  expect(screen.getByLabelText('Selected initiative')).toHaveValue('First')
  fireEvent.click(screen.getByRole('button', { name: 'Views' }))
  expect(screen.getByLabelText('Draft')).toHaveValue('unsaved')
})

it('hides sections disabled by project metadata while retaining issues', async () => {
  const disabledApi = {
    ...api,
    getProject: vi.fn().mockResolvedValue({
      ...metadata,
      project: { ...project, initiativesEnabled: false, dashboardsEnabled: false }
    })
  }
  render(
    <PlanningShell
      api={disabledApi}
      project={project}
      connection={connection}
      onUseIssue={vi.fn()}
    />
  )
  expect(await screen.findByText('Issues content')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Initiatives' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Dashboards' })).not.toBeInTheDocument()
})

it('shows issues while preferences load and ignores the previous project timezone', async () => {
  let resolveFirst!: (value: Awaited<ReturnType<ItsaplanPlanningApi['capabilities']>>) => void
  let resolveSecond!: (value: Awaited<ReturnType<ItsaplanPlanningApi['capabilities']>>) => void
  const first = new Promise<Awaited<ReturnType<ItsaplanPlanningApi['capabilities']>>>((resolve) => {
    resolveFirst = resolve
  })
  const second = new Promise<Awaited<ReturnType<ItsaplanPlanningApi['capabilities']>>>(
    (resolve) => {
      resolveSecond = resolve
    }
  )
  const capabilities = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)
  const testApi = fixtureApi({
    planning: fixturePlanning({ capabilities }),
    getProject: vi.fn().mockResolvedValue(metadata)
  })
  const props = { api: testApi, project, connection, onUseIssue: vi.fn() }
  const { rerender } = render(<PlanningShell {...props} />)
  expect(await screen.findByText('Issues content')).toBeVisible()
  rerender(<PlanningShell {...props} project={{ ...project, ref: 'b' }} />)
  await screen.findByText('Issues content')
  const flags = {
    privateViews: false,
    hiddenViews: false,
    publishViews: false,
    tabOrder: false,
    favorites: false
  }
  await act(async () => {
    resolveFirst({ ...flags, timeZone: 'Europe/Paris' })
  })
  fireEvent.click(screen.getByRole('button', { name: 'Views' }))
  expect(screen.queryByText('Europe/Paris')).not.toBeInTheDocument()
  await act(async () => {
    resolveSecond({ ...flags, timeZone: 'Europe/Nicosia' })
  })
  expect(await screen.findByText('Europe/Nicosia')).toBeVisible()
})
