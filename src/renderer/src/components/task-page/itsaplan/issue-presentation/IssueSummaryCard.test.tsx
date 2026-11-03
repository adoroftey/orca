// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ItsaplanProjectDetails } from '../../../../../../shared/itsaplan/types'
import { IssueSummaryCard } from './IssueSummaryCard'
afterEach(cleanup)
it('separates title, description, status, label and each child status', () => {
  const metadata: ItsaplanProjectDetails = {
    project: { id: 1, key: 'P', ref: 'p', name: 'P' },
    assignees: [{ userId: 'a', name: 'Worker', kind: 'agent' }],
    labels: [{ id: 5, name: 'Urgent' }],
    columns: [
      { id: 1, name: 'Doing', stateType: 'started', color: '', position: 0 },
      { id: 2, name: 'Done', stateType: 'completed', color: '', position: 1 }
    ]
  }
  const issue = {
    id: 1,
    sequenceNumber: 1,
    identifier: 'P-1',
    title: 'Parent',
    description: '<script>text</script>',
    columnId: 1,
    assigneeUserId: 'a',
    priority: 'High',
    labelIds: [5]
  }
  const child = { ...issue, id: 2, identifier: 'P-2', title: 'Child', parentId: 1, columnId: 2 }
  const { container } = render(
    <IssueSummaryCard
      issue={issue}
      metadata={metadata}
      allIssues={[issue, child]}
      onOpenIssue={vi.fn()}
    />
  )
  expect(screen.getByText('Parent')).toBeInTheDocument()
  expect(screen.getByText('<script>text</script>')).toBeInTheDocument()
  expect(container.querySelector('script')).toBeNull()
  expect(screen.getByText('Urgent')).toBeInTheDocument()
  expect(screen.getByText(/Done/)).toBeInTheDocument()
  expect(screen.getByText(/Agent/)).toBeInTheDocument()
})
it('shows real archive state and one labeled relative updated time', () => {
  const stamp = new Date(Date.now() - 86400000).toISOString()
  const issue = {
    id: 3,
    sequenceNumber: 3,
    identifier: 'P-3',
    title: 'Archived result',
    columnId: 1,
    assigneeUserId: null,
    priority: null,
    archived: true,
    createdAt: stamp,
    updatedAt: stamp
  }
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const { container, rerender } = render(
    <IssueSummaryCard issue={issue} metadata={null} onOpenIssue={vi.fn()} />
  )
  expect(screen.getByText('Archived')).toBeInTheDocument()
  expect(screen.getByText(/Updated/)).toHaveTextContent(/yesterday|day/)
  expect(container.querySelector('time')).toHaveAttribute('datetime', stamp)
  expect(screen.queryByText(stamp)).not.toBeInTheDocument()
  expect(error).not.toHaveBeenCalled()
  rerender(
    <IssueSummaryCard
      issue={{ ...issue, archived: false, archivedAt: stamp }}
      metadata={null}
      onOpenIssue={vi.fn()}
      properties={[]}
    />
  )
  expect(screen.getByText('Archived')).toBeInTheDocument()
  expect(screen.queryByText(/Updated/)).not.toBeInTheDocument()
  expect(container.querySelector('time')).toBeNull()
  error.mockRestore()
})
