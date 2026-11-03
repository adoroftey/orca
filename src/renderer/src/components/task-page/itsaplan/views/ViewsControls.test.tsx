import { groupOptions } from './ViewLayoutOptions'
import { ViewCalendar } from './ViewCalendar'
// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ViewEditor } from './ViewEditor'
import { PlanningFilterEditor } from './FilterEditor'
import type {
  ItsaplanProjectDetails,
  ItsaplanApi,
  ItsaplanIssue
} from '../../../../../../shared/itsaplan/types'
afterEach(cleanup)
const metadata: ItsaplanProjectDetails = {
  project: { id: 1, key: 'P', ref: 'p', name: 'P' },
  columns: [{ id: 7, name: 'Ready', stateType: 'open', color: '', position: 0 }],
  assignees: [{ userId: 'u1', name: 'Alice', kind: 'member' }],
  customFields: [
    { id: 9, name: 'Color', fieldType: 'select', options: [{ id: 3, name: 'Red' }] },
    { id: 10, name: 'Reviewer', fieldType: 'member' }
  ]
}
it('selects None as null and status as a numeric ID', () => {
  const change = vi.fn()
  render(
    <PlanningFilterEditor
      metadata={metadata}
      value={{ conditions: [{ field: 'status', op: 'is', values: [] }] }}
      onChange={change}
    />
  )
  const select = screen.getByLabelText('Value')
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error('Expected a select')
  }
  for (const option of select.options) {
    option.selected = option.textContent === 'None' || option.textContent === 'Ready'
  }
  fireEvent.change(select)
  expect(change).toHaveBeenCalledWith({
    conditions: [{ field: 'status', op: 'is', values: [null, 7] }]
  })
})
it('offers human-readable custom options and members', () => {
  const { rerender } = render(
    <PlanningFilterEditor
      metadata={metadata}
      value={{ conditions: [{ field: 'cf:9', op: 'is', values: [] }] }}
      onChange={vi.fn()}
    />
  )
  expect(screen.getByRole('option', { name: 'Red' })).toBeInTheDocument()
  rerender(
    <PlanningFilterEditor
      metadata={metadata}
      value={{ conditions: [{ field: 'cf:10', op: 'is', values: [] }] }}
      onChange={vi.fn()}
    />
  )
  expect(screen.getByRole('option', { name: 'Alice' })).toBeInTheDocument()
})

import { ItsaplanViewsPanel } from './ViewsPanel'
import type { ItsaplanPlanningApi } from '../../../../../../shared/itsaplan/planning-types'
it('allows a reader to create a private view without shared create permission', async () => {
  const project = metadata.project
  const api = {
    ...apiDefaults,
    listIssues: vi.fn().mockResolvedValue([])
  } satisfies ItsaplanApi
  const planning = {
    ...planningDefaults,
    capabilities: vi.fn().mockResolvedValue({ privateViews: true }),
    listViews: vi.fn().mockResolvedValue([]),
    createView: vi.fn().mockResolvedValue({ id: 4 })
  } satisfies ItsaplanPlanningApi
  render(
    <ItsaplanViewsPanel
      project={project}
      metadata={{ ...metadata, permissions: { views: { read: true } } }}
      api={api}
      planning={planning}
      onOpenIssue={vi.fn()}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'New private view' }))
  expect(planning.createView).toHaveBeenCalledWith(
    'p',
    expect.objectContaining({ isPrivate: true })
  )
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

it('offers initiative groups from board issues in the view editor', () => {
  const issue: ItsaplanIssue = {
    id: 1,
    sequenceNumber: 1,
    identifier: 'P-1',
    title: 'Issue',
    columnId: 7,
    assigneeUserId: null,
    priority: null,
    projectId: 1,
    description: '',
    createdAt: '',
    updatedAt: '',
    initiative: { id: 42, title: 'Launch', status: 'active' }
  }
  render(
    <ViewEditor
      metadata={metadata}
      issues={[issue]}
      onChange={vi.fn()}
      value={{
        id: 1,
        projectId: 1,
        name: 'View',
        icon: null,
        filters: {},
        display: { group: 'initiative' },
        position: 0,
        createdAt: ''
      }}
    />
  )
  expect(screen.getAllByRole('option', { name: 'Launch' }).length).toBeGreaterThan(0)
})

it('offers real option labels and applies member scope to filters and groups', () => {
  const scoped: ItsaplanProjectDetails = {
    ...metadata,
    assignees: [
      { userId: 'u1', name: 'Alice', kind: 'member' as const },
      { userId: 'a1', name: 'Agent', kind: 'agent' as const }
    ],
    customFields: [
      { id: 9, name: 'Color', fieldType: 'select', options: [{ id: 3, value: 'Blue' }] },
      { id: 10, name: 'Reviewer', fieldType: 'member', memberScope: 'humans' }
    ]
  }
  const { rerender } = render(
    <PlanningFilterEditor
      metadata={scoped}
      value={{ conditions: [{ field: 'cf:9', op: 'is', values: [] }] }}
      onChange={vi.fn()}
    />
  )
  expect(screen.getByRole('option', { name: 'Blue' })).toBeInTheDocument()
  rerender(
    <PlanningFilterEditor
      metadata={scoped}
      value={{ conditions: [{ field: 'cf:10', op: 'is', values: [] }] }}
      onChange={vi.fn()}
    />
  )
  expect(screen.getByRole('option', { name: 'Alice' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Agent' })).not.toBeInTheDocument()
  expect(groupOptions('cf:10', scoped).map((x) => x.label)).not.toContain('Agent')
})

it('renders every local day of an actual custom date range', () => {
  const ranged: ItsaplanIssue = {
    id: 51,
    sequenceNumber: 51,
    identifier: 'P-51',
    title: 'Range issue',
    columnId: 7,
    assigneeUserId: null,
    priority: null,
    projectId: 1,
    description: '',
    createdAt: '',
    updatedAt: '',
    fieldValues: [
      {
        fieldId: 15,
        value: '2025-01-01T23:30:00Z',
        valueEnd: '2025-01-04T01:00:00Z',
        optionIds: []
      }
    ]
  }
  render(
    <ViewCalendar
      issues={[ranged]}
      metadata={{ ...metadata, viewer: { timeZone: 'Asia/Nicosia' } }}
      display={{ calendarDateField: 'cf:15' }}
      onOpenIssue={vi.fn()}
    />
  )
  expect(screen.getAllByText(/Range issue/)).toHaveLength(3)
})
