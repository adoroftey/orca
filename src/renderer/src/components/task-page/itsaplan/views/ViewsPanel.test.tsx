// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PlanningFilterEditor } from './FilterEditor'
import type { ItsaplanProjectDetails, ItsaplanApi } from '../../../../../../shared/itsaplan/types'

it('preserves unrecognized filter and condition fields when editing a condition', () => {
  const onChange = vi.fn()
  const value = {
    future: { enabled: true },
    conditions: [{ id: '1', field: 'priority', op: 'is', values: ['high'], futureCondition: 42 }]
  }
  const metadata: ItsaplanProjectDetails = {
    project: { id: 1, key: 'P', ref: 'p', name: 'P' },
    columns: [],
    assignees: []
  }
  render(<PlanningFilterEditor value={value} metadata={metadata} onChange={onChange} />)
  fireEvent.change(screen.getByLabelText('Operator'), { target: { value: 'is_not' } })
  expect(onChange).toHaveBeenCalledWith({
    ...value,
    conditions: [{ ...value.conditions[0], op: 'is_not' }]
  })
})

import { ItsaplanViewsPanel } from './ViewsPanel'
import type { ItsaplanPlanningApi } from '../../../../../../shared/itsaplan/planning-types'
afterEach(cleanup)
it('saves a renamed view without losing unknown filter and display settings', async () => {
  const project = { id: 1, key: 'P', ref: 'p', name: 'P' }
  const metadata = {
    project,
    columns: [],
    assignees: [],
    permissions: { views: { read: true, edit: true } }
  }
  const view = {
    id: 1,
    projectId: 1,
    name: 'Saved',
    icon: null,
    filters: { future: 1 },
    display: { layout: 'table', future: 2 },
    position: 0,
    createdAt: ''
  }
  const planning = {
    ...planningDefaults,
    capabilities: vi.fn().mockResolvedValue({}),
    listViews: vi.fn().mockResolvedValue([view]),
    updateView: vi.fn().mockResolvedValue(view)
  } satisfies ItsaplanPlanningApi
  const api = {
    ...apiDefaults,
    listIssues: vi.fn().mockResolvedValue([])
  } satisfies ItsaplanApi
  render(
    <ItsaplanViewsPanel
      api={api}
      planning={planning}
      project={project}
      metadata={metadata}
      onOpenIssue={vi.fn()}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Saved' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(planning.updateView).toHaveBeenCalledWith(1, { name: 'Renamed' }))
})
it('does not show issues when an effective filter is unknown', async () => {
  const project = { id: 1, key: 'P', ref: 'team name.P', name: 'P' }
  const metadata = { project, columns: [], assignees: [], permissions: { views: { read: true } } }
  const view = {
    id: 1,
    projectId: 1,
    name: 'Unsupported',
    icon: null,
    filters: { conditions: [{ id: '1', field: 'future', op: 'is', values: ['x'] }] },
    display: {},
    position: 0,
    createdAt: ''
  }
  const planning = {
    ...planningDefaults,
    capabilities: vi.fn().mockResolvedValue({}),
    listViews: vi.fn().mockResolvedValue([view])
  } satisfies ItsaplanPlanningApi
  const api = {
    ...apiDefaults,
    listIssues: vi.fn().mockResolvedValue([{ id: 1, identifier: 'P-1', title: 'Secret' }])
  } satisfies ItsaplanApi
  const rendered = render(
    <ItsaplanViewsPanel
      api={api}
      planning={planning}
      project={project}
      metadata={metadata}
      webBaseUrl="https://example.com/base?token=secret"
      onOpenIssue={vi.fn()}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Unsupported' }))
  expect(screen.getByRole('alert')).toHaveTextContent('future:is')
  expect(screen.queryByText(/Secret/)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open in Itsplan' })).toHaveAttribute(
    'href',
    'https://example.com/base/team%20name/P/view/1'
  )
  rendered.rerender(
    <ItsaplanViewsPanel
      api={api}
      planning={planning}
      project={project}
      metadata={metadata}
      onOpenIssue={vi.fn()}
      webBaseUrl="javascript:alert(1)"
    />
  )
  expect(screen.queryByRole('link', { name: 'Open in Itsplan' })).not.toBeInTheDocument()
})
it('moves a card to an empty status only with work item edit permission', async () => {
  const project = { id: 1, key: 'P', ref: 'p', name: 'P' }
  const columns = [
    { id: 1, name: 'Todo', stateType: 'unstarted', color: '', position: 0 },
    { id: 2, name: 'Done', stateType: 'completed', color: '', position: 1 }
  ]
  const metadata = {
    project,
    columns,
    assignees: [],
    permissions: { views: { read: true }, work_items: { edit: true } }
  }
  const view = {
    id: 1,
    projectId: 1,
    name: 'Board',
    icon: null,
    filters: {},
    display: { layout: 'kanban' },
    position: 0,
    createdAt: ''
  }
  const planning = {
    ...planningDefaults,
    capabilities: vi.fn().mockResolvedValue({}),
    listViews: vi.fn().mockResolvedValue([view])
  } satisfies ItsaplanPlanningApi
  const api = {
    ...apiDefaults,
    listIssues: vi
      .fn()
      .mockResolvedValue([{ id: 1, identifier: 'P-1', title: 'Issue', columnId: 1 }]),
    updateIssue: vi.fn().mockResolvedValue({})
  } satisfies ItsaplanApi
  render(
    <ItsaplanViewsPanel
      api={api}
      planning={planning}
      project={project}
      metadata={metadata}
      onOpenIssue={vi.fn()}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Board' }))
  const target = screen.getByText('Done (0)').parentElement?.querySelector('div')
  expect(target).toBeTruthy()
  fireEvent.drop(target!, { dataTransfer: { getData: () => '1' } })
  await waitFor(() => expect(api.updateIssue).toHaveBeenCalledWith(1, { columnId: 2 }))
})
it('refreshes issues after returning from details without discarding the view draft', async () => {
  const project = { id: 1, key: 'P', ref: 'p', name: 'P' }
  const metadata = {
    project,
    columns: [],
    assignees: [],
    permissions: { views: { read: true, edit: true } }
  }
  const view = {
    id: 1,
    projectId: 1,
    name: 'Saved',
    icon: null,
    filters: {},
    display: {},
    position: 0,
    createdAt: ''
  }
  const planning = {
    ...planningDefaults,
    capabilities: vi.fn().mockResolvedValue({}),
    listViews: vi.fn().mockResolvedValue([view])
  } satisfies ItsaplanPlanningApi
  const api = {
    ...apiDefaults,
    listIssues: vi.fn().mockResolvedValue([])
  } satisfies ItsaplanApi
  const props = { api, planning, project, metadata, onOpenIssue: vi.fn() }
  const rendered = render(<ItsaplanViewsPanel {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Saved' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Draft' } })
  rendered.rerender(<ItsaplanViewsPanel {...props} refreshVersion={1} />)
  await waitFor(() => expect(api.listIssues).toHaveBeenCalledTimes(2))
  expect(screen.getByLabelText('Name')).toHaveValue('Draft')
})

it('retains the draft and refuses to overwrite a conflicting server rename', async () => {
  const project = { id: 1, key: 'P', ref: 'p', name: 'P' }
  const metadata = {
    project,
    columns: [],
    assignees: [],
    permissions: { views: { read: true, edit: true } }
  }
  const view = {
    id: 1,
    projectId: 1,
    name: 'Saved',
    icon: null,
    filters: {},
    display: {},
    position: 0,
    createdAt: ''
  }
  const planning = {
    ...planningDefaults,
    capabilities: vi.fn().mockResolvedValue({}),
    listViews: vi
      .fn()
      .mockResolvedValueOnce([view])
      .mockResolvedValue([{ ...view, name: 'Remote' }]),
    updateView: vi.fn()
  } satisfies ItsaplanPlanningApi
  const api = {
    ...apiDefaults,
    listIssues: vi.fn().mockResolvedValue([])
  } satisfies ItsaplanApi
  render(
    <ItsaplanViewsPanel
      api={api}
      planning={planning}
      project={project}
      metadata={metadata}
      onOpenIssue={vi.fn()}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Saved' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/conflict/i)
  expect(planning.updateView).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Name')).toHaveValue('Draft')
})

it('gates personal actions and executes confirmations only after consent', async () => {
  const project = { id: 1, key: 'P', ref: 'p', name: 'P' }
  const metadata = {
    project,
    columns: [],
    assignees: [],
    permissions: { views: { read: true, create: true } }
  }
  const view = {
    id: 1,
    projectId: 1,
    name: 'Private',
    icon: null,
    filters: {},
    display: {},
    position: 0,
    createdAt: '',
    isPrivate: true,
    favorite: false
  }
  const planning = {
    ...planningDefaults,
    capabilities: vi.fn().mockResolvedValue({
      privateViews: true,
      hiddenViews: true,
      publishViews: true,
      favorites: true,
      tabOrder: true
    }),
    listViews: vi.fn().mockResolvedValue([view]),
    favoriteView: vi.fn().mockResolvedValue(undefined),
    hideView: vi.fn().mockResolvedValue(undefined),
    publishView: vi.fn().mockResolvedValue(view),
    deleteView: vi.fn().mockResolvedValue(undefined)
  } satisfies ItsaplanPlanningApi
  const api = {
    ...apiDefaults,
    listIssues: vi.fn().mockResolvedValue([])
  } satisfies ItsaplanApi
  render(
    <ItsaplanViewsPanel
      api={api}
      planning={planning}
      project={project}
      metadata={metadata}
      onOpenIssue={vi.fn()}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Private' }))
  expect(await screen.findByRole('button', { name: 'New private view' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Favorite' }))
  await waitFor(() => expect(planning.favoriteView).toHaveBeenCalledWith(1, true))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Hide' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Hide' }))
  await waitFor(() => expect(planning.hideView).toHaveBeenCalledWith(1, true))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(planning.publishView).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Publish' }).at(-1)!)
  await waitFor(() => expect(planning.publishView).toHaveBeenCalledWith(1))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(planning.deleteView).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1)!)
  await waitFor(() => expect(planning.deleteView).toHaveBeenCalledWith(1))
})

it('uses personal order when supported and shared order only with edit rights', async () => {
  const project = { id: 1, key: 'P', ref: 'p', name: 'P' }
  const metadata = {
    project,
    columns: [],
    assignees: [],
    permissions: { views: { read: true, edit: true } }
  }
  const view = {
    id: 1,
    projectId: 1,
    name: 'First',
    icon: null,
    filters: {},
    display: {},
    position: 0,
    createdAt: ''
  }
  const planning = {
    ...planningDefaults,
    capabilities: vi.fn().mockResolvedValue({ tabOrder: true }),
    listViews: vi.fn().mockResolvedValue([view, { ...view, id: 2, name: 'Second' }]),
    arrangeViewTabs: vi.fn().mockResolvedValue([]),
    reorderViews: vi.fn().mockResolvedValue([])
  } satisfies ItsaplanPlanningApi
  const api = {
    ...apiDefaults,
    listIssues: vi.fn().mockResolvedValue([])
  } satisfies ItsaplanApi
  const props = { api, planning, project, metadata, onOpenIssue: vi.fn() }
  const rendered = render(<ItsaplanViewsPanel {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: 'First' }))
  await waitFor(() => expect(planning.capabilities).toHaveBeenCalled())
  fireEvent.click(await screen.findByRole('button', { name: 'Move later' }))
  await waitFor(() => expect(planning.arrangeViewTabs).toHaveBeenCalledWith('p', [2, 1]))
  rendered.unmount()
  vi.mocked(planning.capabilities).mockResolvedValue({
    privateViews: false,
    hiddenViews: false,
    publishViews: false,
    favorites: false,
    tabOrder: false
  })
  render(<ItsaplanViewsPanel {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: 'First' }))
  fireEvent.click(screen.getByRole('button', { name: 'Move later' }))
  await waitFor(() => expect(planning.reorderViews).toHaveBeenCalledWith('p', [2, 1]))
  expect(screen.queryByRole('button', { name: 'Favorite' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Hide' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
})

async function unexpectedCall(): Promise<never> {
  throw new Error('Unexpected API call')
}

const apiDefaults: ItsaplanApi = {
  listProjects: unexpectedCall,
  getProject: unexpectedCall,
  listIssues: unexpectedCall,
  searchIssues: unexpectedCall,
  getIssue: unexpectedCall,
  createIssue: unexpectedCall,
  updateIssue: unexpectedCall,
  listComments: unexpectedCall,
  addComment: unexpectedCall,
  status: unexpectedCall,
  connect: unexpectedCall,
  disconnect: unexpectedCall
}

const planningDefaults: ItsaplanPlanningApi = {
  capabilities: unexpectedCall,
  listInitiatives: unexpectedCall,
  getInitiative: unexpectedCall,
  createInitiative: unexpectedCall,
  updateInitiative: unexpectedCall,
  deleteInitiative: unexpectedCall,
  initiativeFeed: unexpectedCall,
  listViews: unexpectedCall,
  createView: unexpectedCall,
  updateView: unexpectedCall,
  deleteView: unexpectedCall,
  favoriteView: unexpectedCall,
  hideView: unexpectedCall,
  publishView: unexpectedCall,
  reorderViews: unexpectedCall,
  arrangeViewTabs: unexpectedCall,
  listDashboards: unexpectedCall,
  createDashboard: unexpectedCall,
  updateDashboard: unexpectedCall,
  deleteDashboard: unexpectedCall,
  reorderDashboards: unexpectedCall,
  analytics: unexpectedCall
}
