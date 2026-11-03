// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { unsupported } from './ViewDisplayEditor'
import type {
  ItsaplanProjectDetails,
  ItsaplanApi,
  ItsaplanIssue
} from '../../../../../../shared/itsaplan/types'

it('accepts standard visibility settings and member custom grouping', () => {
  const metadata: ItsaplanProjectDetails = {
    project: { id: 1, key: 'P', ref: 'p', name: 'P' },
    columns: [],
    assignees: [],
    customFields: [{ id: 5, name: 'Owner', fieldType: 'member' }]
  }
  expect(
    unsupported(
      {
        showLinks: true,
        showSubtasks: false,
        separateSubtasks: true,
        collapseSubtasks: true,
        timelineCollapseAll: true,
        group: 'cf:5'
      },
      metadata
    )
  ).toEqual([])
})

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ViewCalendar } from './ViewCalendar'
import { ViewKanban } from './ViewKanban'
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
const metadata: ItsaplanProjectDetails = {
  project: { id: 1, key: 'P', ref: 'p', name: 'P' },
  columns: [
    { id: 1, name: 'Todo', stateType: 'open', color: '', position: 0 },
    { id: 2, name: 'Done', stateType: 'closed', color: '', position: 1 }
  ],
  assignees: []
}
const issue: ItsaplanIssue = {
  id: 1,
  sequenceNumber: 1,
  identifier: 'P-1',
  title: 'Parent',
  columnId: 1,
  assigneeUserId: null,
  priority: null,
  projectId: 1,
  description: '',
  createdAt: '',
  updatedAt: '',
  dueDate: '2026-03-02',
  fieldValues: [{ fieldId: 5, value: 'broken', optionIds: [] }]
}
it('honors namespaced group visibility and denies a read-only status drop', () => {
  const updateIssue = vi.fn()
  const api = {
    ...apiDefaults,
    updateIssue
  } satisfies ItsaplanApi
  const { rerender } = render(
    <ViewKanban
      issues={[issue]}
      allIssues={[issue]}
      metadata={metadata}
      display={{ hiddenGroups: ['c1'] }}
      onOpenIssue={vi.fn()}
      api={api}
      canEdit={false}
      onUpdated={vi.fn()}
    />
  )
  expect(screen.queryByText(/Parent/)).not.toBeInTheDocument()
  rerender(
    <ViewKanban
      issues={[issue]}
      metadata={metadata}
      display={{ pinnedGroup: 'c2', collapsedGroups: ['c1'] }}
      onOpenIssue={vi.fn()}
      api={api}
      canEdit={false}
      onUpdated={vi.fn()}
    />
  )
  expect(screen.queryByText(/Parent/)).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Done (0)' }).parentElement?.parentElement?.firstElementChild
  ).toHaveTextContent('Done')
  const target = screen
    .getByRole('button', { name: 'Done (0)' })
    .parentElement?.querySelector('div')
  if (target) {
    fireEvent.drop(target, { dataTransfer: { getData: () => '1' } })
  }
  expect(updateIssue).not.toHaveBeenCalled()
})
it('places malformed custom dates in the undated bucket', () => {
  render(
    <ViewCalendar
      issues={[issue]}
      metadata={metadata}
      display={{ calendarDateField: 'cf:5', weekStart: 1 }}
      onOpenIssue={vi.fn()}
    />
  )
  expect(screen.getByText('No date')).toBeInTheDocument()
  expect(screen.getByText(/Parent/)).toBeInTheDocument()
})

import { ViewTable } from './ViewTable'
import { ViewTimeline } from './ViewTimeline'
it('shows nested subtasks in table and timeline by default', () => {
  const child = { ...issue, id: 2, identifier: 'P-2', title: 'Child', parentId: 1 }
  const props = {
    issues: [issue, child],
    allIssues: [issue, child],
    metadata,
    display: { group: 'none' },
    onOpenIssue: vi.fn()
  }
  const { rerender } = render(<ViewTable {...props} />)
  expect(screen.getByText(/P-2 Child/)).toBeInTheDocument()
  rerender(<ViewTimeline {...props} />)
  expect(screen.getByText(/P-2 Child/)).toBeInTheDocument()
})
it('restricts empty status groups by status type', () => {
  render(
    <ViewTable
      issues={[]}
      metadata={metadata}
      display={{ group: 'status' }}
      filters={{ conditions: [{ field: 'statusType', op: 'is', values: ['open'] }] }}
      onOpenIssue={vi.fn()}
    />
  )
  expect(screen.getByRole('button', { name: 'Todo (0)' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Done (0)' })).not.toBeInTheDocument()
})

it('restricts custom member group choices by scope and filter', () => {
  const scoped = {
    ...metadata,
    assignees: [
      { userId: 'u', name: 'Member', kind: 'member' as const },
      { userId: 'a', name: 'Agent', kind: 'agent' as const }
    ],
    customFields: [{ id: 5, name: 'Owner', fieldType: 'member', memberScope: 'agent' }]
  }
  render(
    <ViewTable
      issues={[]}
      metadata={scoped}
      display={{ group: 'cf:5' }}
      filters={{ conditions: [{ field: 'cf:5', op: 'is', values: ['a'] }] }}
      onOpenIssue={vi.fn()}
    />
  )
  expect(screen.getByText('Agent (0)')).toBeInTheDocument()
  expect(screen.queryByText('Member (0)')).not.toBeInTheDocument()
  expect(screen.queryByText('None (0)')).not.toBeInTheDocument()
})
it('renders links and supports collapsing nested subtasks', () => {
  const parent = { ...issue, links: [{ issueId: 2, relation: 'blocks' }] }
  const child = { ...issue, id: 2, identifier: 'P-2', title: 'Child', parentId: 1 }
  const open = vi.fn()
  render(
    <ViewTable
      issues={[parent, child]}
      allIssues={[parent, child]}
      metadata={metadata}
      display={{ group: 'none', showLinks: true, collapseSubtasks: true }}
      onOpenIssue={open}
    />
  )
  expect(screen.getByText('blocks P-2 Child')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Subtasks/ }))
  fireEvent.click(screen.getByText('P-2 Child'))
  expect(open).toHaveBeenCalledWith(2)
})
it('renders calendar month boundaries and handles invalid dates', () => {
  const dated = { ...issue, startDate: '2026-01-30', dueDate: '2026-03-03' }
  const invalid = { ...issue, id: 2, startDate: 'invalid', dueDate: 'invalid' }
  const { container } = render(
    <ViewTimeline
      issues={[dated, invalid]}
      metadata={metadata}
      display={{ group: 'none', timelineScale: 'month' }}
      onOpenIssue={vi.fn()}
    />
  )
  expect(screen.getByText(/Feb 1/)).toBeInTheDocument()
  expect(screen.getByText(/Mar 1/)).toBeInTheDocument()
  expect(container.innerHTML).not.toContain('NaN')
  expect(screen.getByRole('img', { name: '2026-01-30 – 2026-03-03' })).toBeInTheDocument()
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

import { IssueCard } from './ViewIssueLayout'
it('renders saved card property values using the existing formatter', () => {
  vi.setSystemTime(new Date('2026-03-02T12:00:00Z'))
  const savedIssue = {
    ...issue,
    statusSince: '2026-03-01T12:00:00.000Z',
    fieldValues: [{ fieldId: 5, value: 'Custom value', optionIds: [] }]
  }
  render(
    <IssueCard
      issue={savedIssue}
      issues={[savedIssue]}
      metadata={metadata}
      display={{ properties: ['id', 'dueDate', 'statusAge', 'cf:5'] }}
      onOpenIssue={vi.fn()}
    />
  )
  expect(screen.getAllByText('P-1')).toHaveLength(2)
  expect(screen.getByText('2026-03-02')).toBeInTheDocument()
  expect(screen.getByText(/day/)).toBeInTheDocument()
  expect(screen.getByText('Custom value')).toBeInTheDocument()
  expect(screen.getByText('Due date:')).toBeInTheDocument()
  expect(screen.getByText('cf:5:')).toBeInTheDocument()
})
it.each(['card', 'table'])('saved %s shows links only when explicitly enabled', (layout) => {
  const linked = {
    ...issue,
    links: [
      {
        id: 10,
        kind: 'blocks',
        direction: 'outward',
        issue: { ...issue, id: 2, identifier: 'P-2', title: 'Dependency' }
      }
    ]
  }
  const renderView = (showLinks?: boolean) => {
    const props = {
      issues: [linked],
      allIssues: [linked],
      metadata,
      display: { group: 'none', ...(showLinks === undefined ? {} : { showLinks }) },
      onOpenIssue: vi.fn()
    }
    return layout === 'card' ? <IssueCard {...props} issue={linked} /> : <ViewTable {...props} />
  }
  const { rerender } = render(renderView())
  expect(screen.queryByText(/Blocks P-2 Dependency/)).not.toBeInTheDocument()
  rerender(renderView(false))
  expect(screen.queryByText(/Blocks P-2 Dependency/)).not.toBeInTheDocument()
  rerender(renderView(true))
  expect(screen.getByText(/Blocks P-2 Dependency/)).toBeInTheDocument()
})

it('uses status metadata for group and subgroup badges while preserving counts and collapse', () => {
  const colored = {
    ...metadata,
    columns: metadata.columns.map((c) => ({ ...c, color: c.id === 1 ? '#123456' : '#abcdef' }))
  }
  const { rerender } = render(
    <ViewTable
      issues={[issue]}
      metadata={colored}
      display={{ group: 'status' }}
      onOpenIssue={vi.fn()}
    />
  )
  const group = screen.getByRole('button', { name: 'Todo (1)' })
  expect(group.closest('section')).toHaveStyle({ borderColor: '#123456' })
  expect(group.querySelector('[data-slot="badge"]')).toHaveStyle({ borderColor: '#123456' })
  fireEvent.keyDown(group, { key: 'Enter' })
  expect(group).toHaveAttribute('aria-expanded', 'false')
  rerender(
    <ViewTable
      issues={[issue]}
      metadata={colored}
      display={{ group: 'priority', subgroup: 'status' }}
      onOpenIssue={vi.fn()}
    />
  )
  expect(
    screen
      .getAllByText('Todo')
      .find((element) => element.closest('h4'))
      ?.closest('[data-slot="badge"]')
  ).toHaveStyle({
    borderColor: '#123456'
  })
})
