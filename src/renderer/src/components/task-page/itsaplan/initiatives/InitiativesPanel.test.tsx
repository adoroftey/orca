// @vitest-environment happy-dom
import type { ItsaplanApi, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
import type { ItsaplanPlanningApi } from '../../../../../../shared/itsaplan/planning-types'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
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
const project = { id: 1, key: 'P', ref: 'team.P', name: 'Project' }
const metadata: ItsaplanProjectDetails = {
  project,
  columns: [],
  assignees: [],
  permissions: { initiatives: { read: true, create: true, edit: true, delete: true } }
}
const item = {
  id: 1,
  projectId: 1,
  title: 'First',
  description: '',
  status: 'planned',
  ownerUserId: null,
  priority: null,
  startDate: null,
  targetDate: null,
  position: 0,
  createdAt: '',
  updatedAt: '',
  labelIds: [],
  progress: { completed: 0, canceled: 0, total: 0 },
  health: null
}
function setup(details = metadata) {
  const planning = fixturePlanning({
    listInitiatives: vi.fn().mockImplementation((_ref, options) =>
      Promise.resolve({
        items: options.page === 1 ? [item] : [],
        total: 21,
        page: options.page,
        pageSize: options.pageSize
      })
    ),
    getInitiative: vi.fn().mockResolvedValue(item),
    initiativeFeed: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    updateInitiative: vi.fn().mockResolvedValue(item)
  })
  const api = fixtureApi({ listIssues: vi.fn().mockResolvedValue([]) })
  render(
    <ItsaplanInitiativesPanel
      api={api}
      planning={planning}
      project={details.project}
      metadata={details}
      onOpenIssue={vi.fn()}
    />
  )
  return planning
}
afterEach(cleanup)
it('requests the next server page and saves only changed initiative fields', async () => {
  const planning = setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Next page' }))
  await waitFor(() =>
    expect(planning.listInitiatives).toHaveBeenCalledWith(
      'team.P',
      expect.objectContaining({ page: 2, pageSize: 20 })
    )
  )
  fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
  fireEvent.click(await screen.findByRole('button', { name: 'First' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Changed' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(planning.updateInitiative).toHaveBeenCalledWith(1, { title: 'Changed' })
  )
})
it('does not expose mutation controls without permission', async () => {
  setup({ ...metadata, permissions: { initiatives: { read: true } } })
  fireEvent.click(await screen.findByRole('button', { name: 'First' }))
  await screen.findByText(/Progress:/)
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'New initiative' })).not.toBeInTheDocument()
})
it('keeps edits visible when saving fails', async () => {
  const planning = setup()
  vi.mocked(planning.updateInitiative).mockRejectedValueOnce(new Error('denied'))
  fireEvent.click(await screen.findByRole('button', { name: 'First' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Unsaved' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save initiative.')
  expect(screen.getByLabelText('Title')).toHaveValue('Unsaved')
})
it('hides initiatives when the feature is disabled', () => {
  const planning = setup({ ...metadata, project: { ...project, initiativesEnabled: false } })
  expect(screen.getByText('Initiatives are unavailable for this project.')).toBeInTheDocument()
  expect(planning.listInitiatives).not.toHaveBeenCalled()
})

it('unlinks a linked issue and opens its native issue detail', async () => {
  const issue = { id: 42, identifier: 'P-42', title: 'Linked', initiativeId: 1 }
  const planning = fixturePlanning({
    listInitiatives: vi.fn().mockResolvedValue({ items: [item], total: 1, page: 1, pageSize: 20 }),
    getInitiative: vi.fn().mockResolvedValue(item),
    initiativeFeed: vi.fn().mockResolvedValue({ items: [], nextCursor: null })
  })
  const api = fixtureApi({
    listIssues: vi.fn().mockResolvedValue([issue]),
    updateIssue: vi.fn().mockResolvedValue({ ...issue, initiativeId: null })
  })
  const onOpenIssue = vi.fn()
  render(
    <ItsaplanInitiativesPanel
      api={api}
      planning={planning}
      project={project}
      metadata={{ ...metadata, permissions: { ...metadata.permissions, issues: { edit: true } } }}
      onOpenIssue={onOpenIssue}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'First' }))
  fireEvent.click(await screen.findByRole('button', { name: 'P-42 Linked' }))
  expect(onOpenIssue).toHaveBeenCalledWith(42)
  fireEvent.click(screen.getByRole('button', { name: 'Unlink' }))
  await waitFor(() => expect(api.updateIssue).toHaveBeenCalledWith(42, { initiativeId: null }))
})
it('ignores a previous project response after switching projects', async () => {
  let resolveOld!: (value: unknown) => void
  const old = new Promise((resolve) => {
    resolveOld = resolve
  })
  const planning = fixturePlanning({
    listInitiatives: vi.fn().mockImplementation((ref) =>
      ref === project.ref
        ? old
        : Promise.resolve({
            items: [{ ...item, id: 2, title: 'New project item' }],
            total: 1,
            page: 1,
            pageSize: 20
          })
    )
  })
  const api = fixtureApi()
  const view = render(
    <ItsaplanInitiativesPanel
      api={api}
      planning={planning}
      project={project}
      metadata={metadata}
      onOpenIssue={vi.fn()}
    />
  )
  const nextProject = { ...project, ref: 'team.NEW' }
  view.rerender(
    <ItsaplanInitiativesPanel
      api={api}
      planning={planning}
      project={nextProject}
      metadata={{ ...metadata, project: nextProject }}
      onOpenIssue={vi.fn()}
    />
  )
  await screen.findByRole('button', { name: 'New project item' })
  resolveOld({ items: [item], total: 1, page: 1, pageSize: 20 })
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'First' })).not.toBeInTheDocument()
  )
})
it('links an existing issue to the selected initiative', async () => {
  const issue = { id: 43, identifier: 'P-43', title: 'Available', initiativeId: null }
  const planning = fixturePlanning({
    listInitiatives: vi.fn().mockResolvedValue({ items: [item], total: 1, page: 1, pageSize: 20 }),
    getInitiative: vi.fn().mockResolvedValue(item),
    initiativeFeed: vi.fn().mockResolvedValue({ items: [], nextCursor: null })
  })
  const api = fixtureApi({
    listIssues: vi.fn().mockResolvedValue([issue]),
    updateIssue: vi.fn().mockResolvedValue({ ...issue, initiativeId: 1 })
  })
  render(
    <ItsaplanInitiativesPanel
      api={api}
      planning={planning}
      project={project}
      metadata={{ ...metadata, permissions: { ...metadata.permissions, issues: { edit: true } } }}
      onOpenIssue={vi.fn()}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'First' }))
  fireEvent.click(await screen.findByLabelText('Choose issue'))
  fireEvent.click(await screen.findByRole('option', { name: 'P-43 Available' }))
  fireEvent.click(screen.getByRole('button', { name: 'Link issue' }))
  await waitFor(() => expect(api.updateIssue).toHaveBeenCalledWith(43, { initiativeId: 1 }))
})
