// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  ItsaplanIssueSummary,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import { buildExecutionRows, executionStages } from './execution-board-model'
import { IssueExecutionMatrix } from './IssueExecutionMatrix'
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
it('renders filtered children in their own stage and full-data counts in headers', () => {
  const parent = issue(1, 1),
    child = issue(2, 2, 1),
    hidden = issue(3, 1, 1),
    all = [parent, child, hidden],
    open = vi.fn()
  render(
    <IssueExecutionMatrix
      rows={buildExecutionRows([child], all, metadata)}
      stages={executionStages(all, metadata)}
      metadata={metadata}
      allIssues={all}
      onOpenIssue={open}
    />
  )
  expect(screen.getByText('Context')).toBeInTheDocument()
  expect(screen.getByText(/Loaded children: 1\/2/)).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Todo 2' })).toBeInTheDocument()
  const cells = screen.getAllByRole('cell')
  expect(within(cells[0]).queryByText('Issue 2')).not.toBeInTheDocument()
  fireEvent.click(within(cells[1]).getByRole('button', { name: /Issue 2/ }))
  expect(open).toHaveBeenCalledWith(2)
  expect(screen.queryByText('Issue 3')).not.toBeInTheDocument()
})
it('renders the matched parent marker in its own stage once', () => {
  const parent = issue(1, 1),
    child = issue(2, 2, 1),
    all = [parent, child]
  render(
    <IssueExecutionMatrix
      rows={buildExecutionRows(all, all, metadata)}
      stages={executionStages(all, metadata)}
      metadata={metadata}
      allIssues={all}
      onOpenIssue={vi.fn()}
    />
  )
  const cells = screen.getAllByRole('cell')
  expect(within(cells[0]).getAllByRole('button', { name: /Issue 1/ })).toHaveLength(1)
  expect(within(cells[1]).getAllByRole('button', { name: /Issue 2/ })).toHaveLength(1)
  expect(screen.queryByText('Context')).not.toBeInTheDocument()
})
it('preserves the matched parent action in its stage cell', () => {
  const parent = issue(1, 1),
    child = issue(2, 2, 1),
    all = [parent, child],
    unlink = vi.fn()
  render(
    <IssueExecutionMatrix
      rows={buildExecutionRows(all, all, metadata)}
      stages={executionStages(all, metadata)}
      metadata={metadata}
      allIssues={all}
      onOpenIssue={vi.fn()}
      renderActions={(item) => <button onClick={() => unlink(item.id)}>Unlink {item.id}</button>}
    />
  )
  const cells = screen.getAllByRole('cell')
  fireEvent.click(within(cells[0]).getByRole('button', { name: 'Unlink 1' }))
  expect(unlink).toHaveBeenCalledWith(1)
  expect(within(cells[1]).queryByRole('button', { name: 'Unlink 1' })).not.toBeInTheDocument()
})
it('uses validated status colors for borders and decorative dots without coloring text', () => {
  const colored = {
    ...metadata,
    columns: [
      { ...metadata.columns[0], color: '#3b82f6' },
      { ...metadata.columns[1], color: 'not-a-color' }
    ]
  }
  const items = [issue(1, 1)]
  render(
    <IssueExecutionMatrix
      rows={buildExecutionRows(items, items, colored)}
      stages={executionStages(items, colored)}
      metadata={colored}
      allIssues={items}
      onOpenIssue={vi.fn()}
    />
  )
  const header = screen.getByRole('columnheader', { name: 'Todo 1' })
  expect(header.style.borderColor).toBe('#3b82f6')
  expect(header.style.color).toBe('')
  expect(header.querySelector('[aria-hidden="true"]')).toHaveStyle({ color: '#3b82f6' })
  expect(screen.getAllByRole('cell')[0].style.borderColor).toBe('#3b82f6')
  expect(screen.getByRole('columnheader', { name: 'Done 0' }).style.borderColor).toBe(
    'var(--muted-foreground)'
  )
})
