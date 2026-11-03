// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  ItsaplanIssueSummary,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import { IssueStatusBoard } from './IssueStatusBoard'

const metadata: ItsaplanProjectDetails = {
  project: { id: 1, key: 'P', ref: 'P', name: 'P' },
  assignees: [],
  columns: [
    { id: 1, name: 'Todo', stateType: 'unstarted', color: '', position: 0 },
    { id: 2, name: 'Done', stateType: 'completed', color: '', position: 1 }
  ]
}
const issue = (id: number, columnId: number, parentId?: number): ItsaplanIssueSummary => ({
  id,
  sequenceNumber: id,
  identifier: `P-${id}`,
  title: `Issue ${id}`,
  columnId,
  parentId,
  assigneeUserId: null,
  priority: null
})
afterEach(cleanup)
it('counts only supplied issues and filters children by their own stage', () => {
  const parent = issue(1, 1)
  const child = issue(2, 2, 1)
  const hidden = issue(3, 1, 1)
  render(
    <IssueStatusBoard
      issues={[parent, child]}
      allIssues={[parent, child, hidden]}
      metadata={metadata}
      onOpenIssue={vi.fn()}
    />
  )
  expect(screen.getByRole('button', { name: 'All (2)' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Done (1)' }))
  expect(screen.getByRole('heading', { name: 'Todo 1' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Done 1' })).toBeInTheDocument()
  expect(screen.getByText('Issue 2')).toBeInTheDocument()
  expect(screen.queryByText('Issue 1')).not.toBeInTheDocument()
  expect(screen.queryByText('Issue 3')).not.toBeInTheDocument()
})

it('keeps empty stages in filters without occupying a lane until selected', () => {
  render(<IssueStatusBoard issues={[issue(1, 1)]} metadata={metadata} onOpenIssue={vi.fn()} />)
  const emptyFilter = screen.getByRole('button', { name: 'Done (0)' })
  expect(screen.queryByRole('heading', { name: 'Done 0' })).not.toBeInTheDocument()
  fireEvent.click(emptyFilter)
  expect(screen.getByRole('heading', { name: 'Done 0' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Todo 1' })).toBeInTheDocument()
  expect(screen.queryByText('Issue 1')).not.toBeInTheDocument()
  expect(screen.getByText('No issues in this selection.')).toBeInTheDocument()
})

it('resets the filter for a changed dataset or project and preserves it for status changes', () => {
  const onOpenIssue = vi.fn()
  const { rerender } = render(
    <IssueStatusBoard
      issues={[issue(1, 1), issue(2, 2)]}
      metadata={metadata}
      onOpenIssue={onOpenIssue}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Done (1)' }))
  rerender(
    <IssueStatusBoard
      issues={[issue(2, 1), issue(1, 2)]}
      metadata={metadata}
      onOpenIssue={onOpenIssue}
    />
  )
  expect(screen.getByRole('button', { name: 'Done (1)' })).toHaveAttribute('aria-pressed', 'true')
  rerender(
    <IssueStatusBoard
      issues={[issue(1, 2), issue(3, 1)]}
      metadata={metadata}
      onOpenIssue={onOpenIssue}
    />
  )
  expect(screen.getByRole('button', { name: 'All (2)' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Done (1)' }))
  rerender(
    <IssueStatusBoard
      issues={[issue(1, 2), issue(3, 1)]}
      metadata={{ ...metadata, project: { ...metadata.project, id: 2, ref: 'Q' } }}
      onOpenIssue={onOpenIssue}
    />
  )
  expect(screen.getByRole('button', { name: 'All (2)' })).toHaveAttribute('aria-pressed', 'true')
})

it('adapts to the observed container and falls back when matrix no longer fits', () => {
  let resize: (width: number) => void = () => {}
  const original = globalThis.ResizeObserver
  globalThis.ResizeObserver = class implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      resize = (width) => {
        const entry: ResizeObserverEntry = {
          target: document.createElement('div'),
          contentRect: new DOMRectReadOnly(0, 0, width, 0),
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: []
        }
        callback([entry], this)
      }
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  try {
    render(<IssueStatusBoard issues={[issue(1, 1)]} metadata={metadata} onOpenIssue={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Matrix' })).toBeDisabled()
    act(() => resize(1400))
    expect(screen.getByRole('button', { name: 'Matrix' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Matrix' }))
    act(() => resize(900))
    expect(screen.getByRole('button', { name: 'Matrix' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Todo 1' })).toHaveAttribute('aria-expanded', 'true')
    act(() => resize(600))
    expect(screen.getByRole('button', { name: 'Todo 1' })).toHaveAttribute('aria-expanded', 'true')
  } finally {
    globalThis.ResizeObserver = original
  }
})
it('filters unknown stages and exposes a named board landmark', () => {
  render(
    <IssueStatusBoard
      issues={[issue(1, 1), issue(2, 99)]}
      metadata={metadata}
      onOpenIssue={vi.fn()}
    />
  )
  expect(screen.getByRole('region', { name: 'Board' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Unknown (1)' }))
  expect(screen.getByRole('button', { name: 'Unknown (1)' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  expect(screen.getByText('Issue 2')).toBeInTheDocument()
  expect(screen.queryByText('Issue 1')).not.toBeInTheDocument()
})

it('uses a named group for compact boards', () => {
  render(<IssueStatusBoard issues={[]} metadata={metadata} compact onOpenIssue={vi.fn()} />)
  expect(screen.getByRole('group', { name: 'Board' })).toBeInTheDocument()
})

it('toggles empty statuses in stages while preserving the selected filter', () => {
  render(<IssueStatusBoard issues={[issue(1, 1)]} metadata={metadata} onOpenIssue={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Todo (1)' }))
  const checkbox = screen.getByRole('checkbox', { name: 'Only statuses with issues' })
  expect(checkbox).toBeChecked()
  fireEvent.click(checkbox)
  expect(screen.getByRole('heading', { name: 'Done 0' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Todo (1)' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(checkbox)
  expect(screen.queryByRole('heading', { name: 'Done 0' })).not.toBeInTheDocument()
})

it('shows all metadata statuses for an empty board when requested', () => {
  render(<IssueStatusBoard issues={[]} metadata={metadata} onOpenIssue={vi.fn()} />)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Only statuses with issues' }))
  expect(screen.getByRole('heading', { name: 'Todo 0' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Done 0' })).toBeInTheDocument()
})

it('toggles empty matrix columns and recalculates the fit', () => {
  let resize: (width: number) => void = () => {}
  const original = globalThis.ResizeObserver
  globalThis.ResizeObserver = class implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      resize = (width) =>
        callback(
          [
            {
              target: document.createElement('div'),
              contentRect: new DOMRectReadOnly(0, 0, width, 0),
              borderBoxSize: [],
              contentBoxSize: [],
              devicePixelContentBoxSize: []
            }
          ],
          this
        )
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  try {
    render(<IssueStatusBoard issues={[issue(1, 1)]} metadata={metadata} onOpenIssue={vi.fn()} />)
    act(() => resize(1400))
    expect(screen.queryByRole('columnheader', { name: 'Done 0' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Only statuses with issues' }))
    expect(screen.getByRole('columnheader', { name: 'Done 0' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Only statuses with issues' }))
    expect(screen.queryByRole('columnheader', { name: 'Done 0' })).not.toBeInTheDocument()
  } finally {
    globalThis.ResizeObserver = original
  }
})

it('falls back from Auto matrix when showing all statuses exceeds available width', () => {
  let resize: (width: number) => void = () => {}
  const original = globalThis.ResizeObserver
  globalThis.ResizeObserver = class implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      resize = (width) =>
        callback(
          [
            {
              target: document.createElement('div'),
              contentRect: new DOMRectReadOnly(0, 0, width, 0),
              borderBoxSize: [],
              contentBoxSize: [],
              devicePixelContentBoxSize: []
            }
          ],
          this
        )
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  const many = {
    ...metadata,
    columns: [
      ...metadata.columns,
      ...[3, 4, 5].map((id) => ({
        id,
        name: `Stage ${id}`,
        stateType: 'started',
        color: '',
        position: id
      }))
    ]
  }
  try {
    render(<IssueStatusBoard issues={[issue(1, 1)]} metadata={many} onOpenIssue={vi.fn()} />)
    act(() => resize(1400))
    expect(screen.getByRole('table')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Only statuses with issues' }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Stage 5 0' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Matrix' })).toBeDisabled()
  } finally {
    globalThis.ResizeObserver = original
  }
})

it('shows status color and decorative state mark on filters without changing selection', () => {
  const colored = {
    ...metadata,
    columns: [
      { ...metadata.columns[0], color: '#3b82f6' },
      { ...metadata.columns[1], color: 'invalid' }
    ]
  }
  render(<IssueStatusBoard issues={[issue(1, 1)]} metadata={colored} onOpenIssue={vi.fn()} />)
  const todo = screen.getByRole('button', { name: 'Todo (1)' })
  expect(todo.style.borderColor).toBe('#3b82f6')
  expect(todo.style.color).toBe('')
  expect(todo.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Done (0)' }).style.borderColor).toBe(
    'var(--muted-foreground)'
  )
  fireEvent.click(todo)
  expect(todo).toHaveAttribute('aria-pressed', 'true')
})
