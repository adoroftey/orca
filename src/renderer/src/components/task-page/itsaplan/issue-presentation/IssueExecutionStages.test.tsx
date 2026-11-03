// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  ItsaplanIssueSummary,
  ItsaplanProjectDetails
} from '../../../../../../shared/itsaplan/types'
import { executionStages } from './execution-board-model'
import { IssueExecutionStages } from './IssueExecutionStages'

const metadata: ItsaplanProjectDetails = {
  project: { id: 1, key: 'P', ref: 'P', name: 'P' },
  assignees: [],
  columns: [
    { id: 1, name: 'Waiting', stateType: 'unstarted', color: '', position: 0 },
    { id: 2, name: 'Active', stateType: 'started', color: '', position: 1 },
    { id: 3, name: 'Done', stateType: 'completed', color: '', position: 2 }
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
it('shows contextual parent and matched child in its own stage while preserving full counts', () => {
  const parent = issue(1, 1),
    child = issue(2, 2, 1),
    done = issue(3, 3, 1)
  render(
    <IssueExecutionStages
      issues={[child]}
      stages={executionStages([parent, child, done], metadata)}
      metadata={metadata}
      allIssues={[parent, child, done]}
      onOpenIssue={vi.fn()}
    />
  )
  expect(screen.getByRole('button', { name: 'Waiting 1' })).toHaveAttribute(
    'aria-expanded',
    'false'
  )
  expect(screen.getByRole('button', { name: 'Done 1' })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('button', { name: 'Active 1' })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('Context')).toBeInTheDocument()
  expect(screen.getByText('Issue 2')).toBeInTheDocument()
  expect(screen.queryByText('Issue 3')).not.toBeInTheDocument()
  expect(screen.getByText(/Loaded children: 1\/2/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Active 1' }))
  expect(screen.queryByText('Issue 2')).not.toBeInTheDocument()
})
it('expands the first waiting stage when waiting is the only work', () => {
  const waiting = issue(1, 1)
  render(
    <IssueExecutionStages
      issues={[waiting]}
      stages={executionStages([waiting], metadata)}
      metadata={metadata}
      allIssues={[waiting]}
      onOpenIssue={vi.fn()}
    />
  )
  expect(screen.getByRole('button', { name: 'Waiting 1' })).toHaveAttribute('aria-expanded', 'true')
})
it('keeps the matched parent action in its own stage', () => {
  const parent = issue(1, 2),
    child = issue(2, 3, 1),
    all = [parent, child],
    unlink = vi.fn()
  render(
    <IssueExecutionStages
      issues={all}
      stages={executionStages(all, metadata)}
      metadata={metadata}
      allIssues={all}
      onOpenIssue={vi.fn()}
      renderActions={(item) => <button onClick={() => unlink(item.id)}>Unlink {item.id}</button>}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Unlink 1' }))
  expect(unlink).toHaveBeenCalledWith(1)
  expect(screen.queryByRole('button', { name: 'Unlink 2' })).not.toBeInTheDocument()
})
it('uses a status border and decorative dot while keeping text neutral', () => {
  const colored = { ...metadata, columns: [{ ...metadata.columns[0], color: '#3b82f6' }] }
  render(
    <IssueExecutionStages
      issues={[]}
      stages={executionStages([], colored)}
      metadata={colored}
      allIssues={[]}
      onOpenIssue={vi.fn()}
    />
  )
  const button = screen.getByRole('button', { name: 'Waiting 0' })
  expect(button.closest('section')?.style.borderColor).toBe('#3b82f6')
  expect(button.style.color).toBe('')
  expect(button.querySelector('[aria-hidden="true"]')).toHaveStyle({ color: '#3b82f6' })
})
