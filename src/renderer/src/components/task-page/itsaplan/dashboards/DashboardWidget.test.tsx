// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
import { makeApi, makePlanning } from './DashboardsPanel.fixture'
import { ItsaplanDashboardWidget } from './DashboardWidget'
import { readDashboardWidgets } from './dashboard-model'
const project = { id: 1, key: 'P', ref: 'team.P', name: 'Project' }
const metadata: ItsaplanProjectDetails = { project, columns: [], assignees: [] }
afterEach(cleanup)
it('shows unsupported filters instead of a false count', () => {
  const widget = readDashboardWidgets([
    {
      type: 'stat',
      config: { filters: { conditions: [{ id: 'x', field: 'future', op: 'is', values: ['a'] }] } }
    }
  ])[0]
  render(
    <ItsaplanDashboardWidget
      widget={widget}
      api={makeApi()}
      planning={makePlanning()}
      project={project}
      metadata={metadata}
      issues={[]}
      onOpenIssue={vi.fn()}
    />
  )
  expect(screen.getByText(/unsupported filter/i)).toBeInTheDocument()
})
it.each(['stat', 'recent_issues'])('rejects unknown root filters in %s widgets', (type) => {
  const widget = readDashboardWidgets([{ type, config: { filters: { futureFilter: 'value' } } }])[0]
  render(
    <ItsaplanDashboardWidget
      widget={widget}
      api={makeApi()}
      planning={makePlanning()}
      project={project}
      metadata={metadata}
      issues={[]}
      onOpenIssue={vi.fn()}
    />
  )
  expect(screen.getByText(/unsupported filter/i)).toBeInTheDocument()
  expect(screen.queryByText('0')).not.toBeInTheDocument()
})
it.each(['stat', 'recent_issues'])('rejects malformed filters in %s widgets', (type) => {
  for (const filters of ['bad', []]) {
    const widget = readDashboardWidgets([{ type, config: { filters } }])[0]
    const rendered = render(
      <ItsaplanDashboardWidget
        widget={widget}
        api={makeApi()}
        planning={makePlanning()}
        project={project}
        metadata={metadata}
        issues={[]}
        onOpenIssue={vi.fn()}
      />
    )
    expect(screen.getByText(/invalid configuration/i)).toBeInTheDocument()
    rendered.unmount()
  }
})
it('isolates analytics failures from other widgets', async () => {
  const planning = makePlanning({
    analytics: vi.fn().mockRejectedValue(new Error('offline'))
  })
  const widgets = readDashboardWidgets([{ type: 'pulse' }, { type: 'stat' }])
  for (const widget of widgets) {
    render(
      <ItsaplanDashboardWidget
        widget={widget}
        api={makeApi()}
        planning={planning}
        project={project}
        metadata={metadata}
        issues={[]}
        onOpenIssue={vi.fn()}
      />
    )
  }
  expect(await screen.findByText(/unable to load/i)).toBeInTheDocument()
  expect(screen.getByText('0')).toBeInTheDocument()
})
it.each([
  [
    'activity_feed',
    'activity',
    { items: [{ id: 1, kind: 'changed', body: 'Updated' }], nextCursor: null },
    'Updated'
  ],
  ['pulse', 'pulse', [{ label: 'Monday', count: 4 }], 'Monday: Count 4'],
  [
    'throughput',
    'throughput',
    [{ week: 'Week 1', created: 3, closed: 2 }],
    'Week 1: Created 3, Closed 2'
  ],
  [
    'burnup',
    'burnup',
    {
      days: [{ date: '2026-01-01', scope: 5, started: 3, completed: 2 }],
      forecast: { remaining: 3 }
    },
    'Remaining'
  ],
  ['breakdown', 'breakdown', [{ label: 'Open', count: 7 }], 'Open: Count 7'],
  ['agent_runs', 'agent-runs', [{ id: 1, agentName: 'Agent', status: 'failed' }], 'Agent failed'],
  ['agent_health', 'agent-run-stats', { total: 10, success: 8, failed: 1, pending: 1 }, 'Total:'],
  [
    'webhook_health',
    'webhook-stats',
    { total: 5, success: 4, failed: 1, pending: 0, activeWebhooks: 2, disabledWebhooks: 1 },
    'Active webhooks:'
  ],
  [
    'agent_workload',
    'agent-workload',
    [
      {
        agentId: 1,
        agentName: 'Worker',
        delegatedOpen: 3,
        runsTotal: 5,
        runsSuccess: 4,
        runsFailed: 1
      }
    ],
    'Worker'
  ]
])('renders %s analytics using %s', async (type, kind, data, expected) => {
  const planning = makePlanning({ analytics: vi.fn().mockResolvedValue(data) })
  const widget = readDashboardWidgets([{ type }])[0]
  render(
    <ItsaplanDashboardWidget
      widget={widget}
      api={makeApi()}
      planning={planning}
      project={project}
      metadata={metadata}
      issues={[]}
      onOpenIssue={vi.fn()}
    />
  )
  expect(await screen.findByText(new RegExp(expected))).toBeInTheDocument()
  expect(planning.analytics).toHaveBeenCalledWith(project.ref, kind, expect.any(Object))
})

it('renders pulse buckets as accessible heatmap cells', async () => {
  const planning = makePlanning({
    analytics: vi.fn().mockResolvedValue([{ label: 'Monday', count: 4 }])
  })
  const widget = readDashboardWidgets([{ type: 'pulse' }])[0]
  render(
    <ItsaplanDashboardWidget
      widget={widget}
      api={makeApi()}
      planning={planning}
      project={project}
      metadata={metadata}
      issues={[]}
      onOpenIssue={vi.fn()}
    />
  )
  expect(await screen.findByLabelText('Monday: 4')).toHaveAttribute('data-heatmap-cell')
})
it('renders burnup lines and forecast range without inventing a forecast', async () => {
  const planning = makePlanning({
    analytics: vi
      .fn()
      .mockResolvedValueOnce({
        days: [{ date: '2026-01-01', scope: 5, started: 3, completed: 2 }],
        forecast: null
      })
      .mockResolvedValueOnce({
        days: [{ date: '2026-01-01', scope: 5, started: 3, completed: 2 }],
        forecast: {
          projectedDate: '2026-02-01',
          optimisticDate: '2026-01-25',
          pessimisticDate: '2026-02-10',
          projectedScope: 5,
          remaining: 3,
          velocityPerDay: 1
        }
      })
  })
  const widget = readDashboardWidgets([{ type: 'burnup', config: { forecast: 'range' } }])[0]
  const view = render(
    <ItsaplanDashboardWidget
      widget={widget}
      api={makeApi()}
      planning={planning}
      project={project}
      metadata={metadata}
      issues={[]}
      onOpenIssue={vi.fn()}
    />
  )
  expect(await screen.findByRole('img', { name: 'Burnup' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Forecast range')).not.toBeInTheDocument()
  expect(screen.queryByText(/optimistic/i)).not.toBeInTheDocument()
  view.unmount()
  render(
    <ItsaplanDashboardWidget
      widget={widget}
      api={makeApi()}
      planning={planning}
      project={project}
      metadata={metadata}
      issues={[]}
      onOpenIssue={vi.fn()}
    />
  )
  expect(await screen.findByText(/optimistic/i)).toBeInTheDocument()
  expect(screen.getByLabelText('Forecast range')).toBeInTheDocument()
  expect(screen.getByText(/velocity/i)).toBeInTheDocument()
})
it('loads the next activity cursor and retains existing items on failure', async () => {
  const cursor = { ts: '2026-01-01', id: 1 }
  const planning = makePlanning({
    analytics: vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: 1, body: 'First' }], nextCursor: cursor })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        items: [
          { id: 1, body: 'First' },
          { id: 2, body: 'Second' }
        ],
        nextCursor: null
      })
  })
  const widget = readDashboardWidgets([{ type: 'activity_feed' }])[0]
  render(
    <ItsaplanDashboardWidget
      widget={widget}
      api={makeApi()}
      planning={planning}
      project={project}
      metadata={metadata}
      issues={[]}
      onOpenIssue={vi.fn()}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: /load more/i }))
  expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument()
  expect(screen.getByText(/First/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /retry/i }))
  expect(await screen.findByText(/Second/)).toBeInTheDocument()
  expect(screen.getAllByText(/First/)).toHaveLength(1)
  await waitFor(() =>
    expect(planning.analytics).toHaveBeenLastCalledWith(
      project.ref,
      'activity',
      expect.objectContaining({ cursor })
    )
  )
})
it.each([
  ['pulse', { pulseScope: 'future' }],
  ['breakdown', { by: 'future' }],
  ['agent_runs', { runStatus: 'future' }],
  ['burnup', { forecast: 'future' }],
  ['recent_issues', { sort: 'future' }]
])('rejects unsupported %s settings without a request', (type, config) => {
  const planning = makePlanning({ analytics: vi.fn() })
  const widget = readDashboardWidgets([{ type, config }])[0]
  render(
    <ItsaplanDashboardWidget
      widget={widget}
      api={makeApi()}
      planning={planning}
      project={project}
      metadata={metadata}
      issues={[]}
      onOpenIssue={vi.fn()}
    />
  )
  expect(screen.getByText(/invalid configuration/i)).toBeInTheDocument()
  expect(planning.analytics).not.toHaveBeenCalled()
})
it('normalizes analytics numbers and removes empty optional filters without changing saved config', async () => {
  const planning = makePlanning({
    analytics: vi.fn().mockResolvedValue({ items: [] })
  })
  const config = { limit: 999, actorUserId: '', action: '' }
  const widget = readDashboardWidgets([{ type: 'activity_feed', config }])[0]
  render(
    <ItsaplanDashboardWidget
      widget={widget}
      api={makeApi()}
      planning={planning}
      project={project}
      metadata={metadata}
      issues={[]}
      onOpenIssue={vi.fn()}
    />
  )
  await waitFor(() =>
    expect(planning.analytics).toHaveBeenCalledWith(project.ref, 'activity', { limit: 100 })
  )
  expect(widget.config).toEqual(config)
})

it('queries an unknown saved activity action unchanged', async () => {
  const planning = makePlanning({
    analytics: vi.fn().mockResolvedValue({ items: [], nextCursor: null })
  })
  const widget = readDashboardWidgets([
    { type: 'activity_feed', config: { action: 'future_action' } }
  ])[0]
  render(
    <ItsaplanDashboardWidget
      widget={widget}
      api={makeApi()}
      planning={planning}
      project={project}
      metadata={metadata}
      issues={[]}
      onOpenIssue={vi.fn()}
    />
  )
  await waitFor(() =>
    expect(planning.analytics).toHaveBeenCalledWith(
      project.ref,
      'activity',
      expect.objectContaining({ action: 'future_action' })
    )
  )
})

it('groups the limited recent issues by stage and shows their labels', () => {
  const details: ItsaplanProjectDetails = {
    ...metadata,
    columns: [{ id: 1, name: 'In progress', stateType: 'started', color: '', position: 1 }],
    labels: [{ id: 1, name: 'Urgent' }]
  }
  const widget = readDashboardWidgets([{ type: 'recent_issues', config: { limit: 1 } }])[0]
  const issue = {
    id: 1,
    sequenceNumber: 1,
    identifier: 'P-1',
    title: 'Visible task',
    columnId: 1,
    assigneeUserId: null,
    priority: null,
    projectId: 1,
    description: '',
    labelIds: [1],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-02'
  }
  render(
    <ItsaplanDashboardWidget
      widget={widget}
      api={makeApi()}
      planning={makePlanning()}
      project={project}
      metadata={details}
      issues={[
        issue,
        { ...issue, id: 2, identifier: 'P-2', title: 'Older task', updatedAt: '2026-01-01' }
      ]}
      onOpenIssue={vi.fn()}
    />
  )
  expect(screen.getByRole('heading', { name: /In progress/ })).toBeInTheDocument()
  expect(screen.getByText('Visible task')).toBeInTheDocument()
  expect(screen.getByText('Urgent')).toBeInTheDocument()
  expect(screen.queryByText('Older task')).not.toBeInTheDocument()
})

it('keeps the full match count and parent context when recent issues are limited', () => {
  const details: ItsaplanProjectDetails = {
    ...metadata,
    columns: [{ id: 1, name: 'In progress', stateType: 'started', color: '', position: 1 }]
  }
  const parent = {
    id: 100,
    sequenceNumber: 100,
    identifier: 'P-100',
    title: 'Parent context',
    columnId: 1,
    assigneeUserId: null,
    priority: null,
    projectId: 1,
    description: '',
    labelIds: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
  const children = Array.from({ length: 8 }, (_, index) => ({
    ...parent,
    id: index + 1,
    sequenceNumber: index + 1,
    identifier: `P-${index + 1}`,
    title: `Child ${index + 1}`,
    parentId: 100,
    updatedAt: `2026-01-${String(index + 2).padStart(2, '0')}`
  }))
  const open = vi.fn()
  render(
    <ItsaplanDashboardWidget
      widget={readDashboardWidgets([{ type: 'recent_issues', config: { limit: 7 } }])[0]}
      api={makeApi()}
      planning={makePlanning()}
      project={project}
      metadata={details}
      issues={[parent, ...children]}
      onOpenIssue={open}
    />
  )
  expect(screen.getByText(/Selected: 7.*Loaded: 7.*Total matching: 9/)).toBeInTheDocument()
  expect(screen.getByText('Context')).toBeInTheDocument()
  expect(screen.getByText(/Loaded children: 0\/8/)).toBeInTheDocument()
  expect(screen.queryByText('Child 1')).not.toBeInTheDocument()
  fireEvent.click(screen.getAllByRole('button', { name: 'P-100 Parent context' })[0])
  expect(open).toHaveBeenCalledWith(100)
})

it('renders a status movement with actor, stages and timestamp', async () => {
  const planning = makePlanning({
    analytics: vi.fn().mockResolvedValue({
      items: [
        {
          id: 1,
          kind: 'activity',
          actorName: 'Alex',
          action: 'status',
          body: null,
          payload: { from: { value: 'Review' }, to: { value: 'In Progress' } },
          createdAt: '2026-01-01T10:00:00Z',
          issueId: 1,
          issueIdentifier: 'P-1'
        }
      ],
      nextCursor: null
    })
  })
  const open = vi.fn()
  render(
    <ItsaplanDashboardWidget
      widget={readDashboardWidgets([{ type: 'activity_feed' }])[0]}
      api={makeApi()}
      planning={planning}
      project={project}
      metadata={metadata}
      issues={[]}
      onOpenIssue={open}
    />
  )
  expect(await screen.findByText('Alex')).toBeInTheDocument()
  expect(screen.getByText(/Review → In Progress/)).toBeInTheDocument()
  expect(document.querySelector('time')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'P-1' }))
  expect(open).toHaveBeenCalledWith(1)
})
