// @vitest-environment happy-dom
import type { ItsaplanApi, ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
import type {
  ItsaplanPlanningApi,
  PlanningActivityItem
} from '../../../../../../shared/itsaplan/planning-types'
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
      metadata={{
        ...metadata,
        permissions: { ...metadata.permissions, work_items: { edit: true, create: true } }
      }}
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
      metadata={{
        ...metadata,
        permissions: { ...metadata.permissions, work_items: { edit: true, create: true } }
      }}
      onOpenIssue={vi.fn()}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'First' }))
  fireEvent.click(await screen.findByLabelText('Choose issue'))
  fireEvent.click(await screen.findByRole('option', { name: 'P-43 Available' }))
  fireEvent.click(screen.getByRole('button', { name: 'Link issue' }))
  await waitFor(() => expect(api.updateIssue).toHaveBeenCalledWith(43, { initiativeId: 1 }))
})
it.each(['create', 'link', 'unlink'])(
  'refreshes server progress and activity after %s',
  async (action) => {
    const issue = {
      id: 42,
      identifier: 'P-42',
      title: 'Task',
      initiativeId: action === 'unlink' ? 1 : null
    }
    const updated = { ...item, progress: { ...item.progress, total: action === 'unlink' ? 0 : 1 } }
    const planning = fixturePlanning({
      listInitiatives: vi
        .fn()
        .mockResolvedValue({ items: [item], total: 1, page: 1, pageSize: 20 }),
      getInitiative: vi.fn().mockResolvedValueOnce(item).mockResolvedValue(updated),
      initiativeFeed: vi
        .fn()
        .mockResolvedValueOnce({ items: [], nextCursor: null })
        .mockResolvedValue({
          items: [
            {
              id: 8,
              kind: 'activity',
              action: 'updated',
              body: 'Server activity',
              createdAt: '2026-01-01'
            }
          ],
          nextCursor: null
        })
    })
    const api = fixtureApi({
      listIssues: vi.fn().mockResolvedValue(action === 'create' ? [] : [issue]),
      updateIssue: vi.fn().mockResolvedValue(issue),
      createIssue: vi.fn().mockResolvedValue(issue)
    })
    render(
      <ItsaplanInitiativesPanel
        api={api}
        planning={planning}
        project={project}
        metadata={{
          ...metadata,
          columns: [{ id: 1, name: 'In progress', stateType: 'started', color: '', position: 1 }],
          permissions: { ...metadata.permissions, work_items: { edit: true, create: true } }
        }}
        onOpenIssue={vi.fn()}
      />
    )
    fireEvent.click(await screen.findByRole('button', { name: 'First' }))
    await screen.findByText(/Progress:/)
    if (action === 'create') {
      fireEvent.click(await screen.findByRole('button', { name: 'New issue' }))
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Created' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create issue' }))
    } else if (action === 'link') {
      fireEvent.click(await screen.findByLabelText('Choose issue'))
      fireEvent.click(await screen.findByRole('option', { name: 'P-42 Task' }))
      fireEvent.click(screen.getByRole('button', { name: 'Link issue' }))
    } else {
      fireEvent.click(await screen.findByRole('button', { name: 'Unlink' }))
    }
    expect(await screen.findByText('Server activity', { exact: false })).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(`Progress: 0 / ${action === 'unlink' ? 0 : 1}`))
    ).toBeInTheDocument()
    expect(planning.getInitiative).toHaveBeenCalledTimes(2)
    expect(planning.initiativeFeed).toHaveBeenCalledTimes(2)
    expect(planning.listInitiatives).toHaveBeenCalledTimes(action === 'create' ? 2 : 1)
  }
)

it('ignores an older activity page after a successful issue mutation', async () => {
  let resolvePage!: (value: { items: PlanningActivityItem[]; nextCursor: null }) => void
  const pending = new Promise<{ items: PlanningActivityItem[]; nextCursor: null }>((resolve) => {
    resolvePage = resolve
  })
  const planning = fixturePlanning({
    listInitiatives: vi.fn().mockResolvedValue({ items: [item], total: 1, page: 1, pageSize: 20 }),
    getInitiative: vi.fn().mockResolvedValue(item),
    initiativeFeed: vi
      .fn()
      .mockResolvedValueOnce({ items: [], nextCursor: { ts: '2026-01-01', id: 1 } })
      .mockReturnValueOnce(pending)
      .mockResolvedValue({ items: [], nextCursor: null })
  })
  const issue = { id: 42, identifier: 'P-42', title: 'Task', initiativeId: null }
  const api = fixtureApi({
    listIssues: vi.fn().mockResolvedValue([issue]),
    updateIssue: vi.fn().mockResolvedValue(issue)
  })
  render(
    <ItsaplanInitiativesPanel
      api={api}
      planning={planning}
      project={project}
      metadata={{
        ...metadata,
        permissions: { ...metadata.permissions, work_items: { edit: true } }
      }}
      onOpenIssue={vi.fn()}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'First' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Load more activity' }))
  fireEvent.click(await screen.findByLabelText('Choose issue'))
  fireEvent.click(await screen.findByRole('option', { name: 'P-42 Task' }))
  fireEvent.click(screen.getByRole('button', { name: 'Link issue' }))
  await waitFor(() => expect(planning.initiativeFeed).toHaveBeenCalledTimes(3))
  await act(async () =>
    resolvePage({
      items: [
        {
          id: 99,
          kind: 'activity',
          actorName: null,
          body: 'Stale activity',
          createdAt: '2026-01-01'
        }
      ],
      nextCursor: null
    })
  )
  expect(screen.queryByText(/Stale activity/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Load more activity' })).not.toBeInTheDocument()
  expect(screen.getByText('No activity yet.')).toBeInTheDocument()
})

it('does not overwrite a saved initiative with a pending pre-save refresh', async () => {
  let resolveOld!: (value: typeof item) => void
  const oldRefresh = new Promise<typeof item>((resolve) => {
    resolveOld = resolve
  })
  const saved = { ...item, title: 'Saved title' }
  const planning = fixturePlanning({
    listInitiatives: vi.fn().mockResolvedValue({ items: [item], total: 1, page: 1, pageSize: 20 }),
    getInitiative: vi
      .fn()
      .mockResolvedValueOnce(item)
      .mockReturnValueOnce(oldRefresh)
      .mockResolvedValue(saved),
    initiativeFeed: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    updateInitiative: vi.fn().mockResolvedValue(saved)
  })
  const issue = { id: 42, identifier: 'P-42', title: 'Task', initiativeId: null }
  const api = fixtureApi({
    listIssues: vi.fn().mockResolvedValue([issue]),
    updateIssue: vi.fn().mockResolvedValue(issue)
  })
  render(
    <ItsaplanInitiativesPanel
      api={api}
      planning={planning}
      project={project}
      metadata={{
        ...metadata,
        permissions: { ...metadata.permissions, work_items: { edit: true } }
      }}
      onOpenIssue={vi.fn()}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'First' }))
  fireEvent.click(await screen.findByLabelText('Choose issue'))
  fireEvent.click(await screen.findByRole('option', { name: 'P-42 Task' }))
  fireEvent.click(screen.getByRole('button', { name: 'Link issue' }))
  await waitFor(() => expect(planning.getInitiative).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Saved title' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByRole('heading', { name: 'Saved title' })
  await waitFor(() => expect(planning.getInitiative).toHaveBeenCalledTimes(3))
  await act(async () => resolveOld(item))
  expect(screen.getByRole('heading', { name: 'Saved title' })).toBeInTheDocument()
})

it('respects denied work item permissions', async () => {
  const issue = { id: 42, identifier: 'P-42', title: 'Linked', initiativeId: 1 }
  const planning = fixturePlanning({
    listInitiatives: vi.fn().mockResolvedValue({ items: [item], total: 1, page: 1, pageSize: 20 }),
    getInitiative: vi.fn().mockResolvedValue(item),
    initiativeFeed: vi.fn().mockResolvedValue({ items: [], nextCursor: null })
  })
  render(
    <ItsaplanInitiativesPanel
      api={fixtureApi({ listIssues: vi.fn().mockResolvedValue([issue]) })}
      planning={planning}
      project={project}
      metadata={{
        ...metadata,
        permissions: { ...metadata.permissions, work_items: { edit: false, create: false } }
      }}
      onOpenIssue={vi.fn()}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'First' }))
  await screen.findByRole('button', { name: 'P-42 Linked' })
  expect(screen.queryByRole('button', { name: 'Unlink' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'New issue' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Link issue' })).not.toBeInTheDocument()
})
it('shows activity status movement from the feed payload', async () => {
  const planning = fixturePlanning({
    listInitiatives: vi.fn().mockResolvedValue({ items: [item], total: 1, page: 1, pageSize: 20 }),
    getInitiative: vi.fn().mockResolvedValue(item),
    initiativeFeed: vi.fn().mockResolvedValue({
      items: [
        {
          id: 1,
          kind: 'activity',
          actorName: 'Agent',
          body: null,
          action: 'status',
          payload: { from: { value: 'Review' }, to: { value: 'In Progress' } },
          createdAt: '2026-11-03T12:00:00Z',
          issueId: 42,
          issueIdentifier: 'P-42'
        }
      ],
      nextCursor: null
    })
  })
  render(
    <ItsaplanInitiativesPanel
      api={fixtureApi({ listIssues: vi.fn().mockResolvedValue([]) })}
      planning={planning}
      project={project}
      metadata={metadata}
      onOpenIssue={vi.fn()}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'First' }))
  expect(await screen.findByText(/Review → In Progress/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'P-42' })).toBeInTheDocument()
})
