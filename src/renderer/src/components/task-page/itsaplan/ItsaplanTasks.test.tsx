// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ItsaplanApi, ItsaplanIssue } from '../../../../../shared/itsaplan/types'
import { ItsaplanTasks } from './ItsaplanTasks'

vi.mock('@/components/sidebar/CommentMarkdown', () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>
}))

const connection = {
  connected: true,
  baseUrl: 'https://api.plan.test',
  webBaseUrl: 'https://plan.test'
}
const projects = [
  { id: 1, key: 'APP', ref: 'team.APP', name: 'Application' },
  { id: 2, key: 'OPS', ref: 'team.OPS', name: 'Operations' }
]
const issue: ItsaplanIssue = {
  id: 42,
  projectId: 1,
  sequenceNumber: 3,
  identifier: 'APP-3',
  title: 'Fix checkout',
  description: 'Full task context',
  columnId: 1,
  assigneeUserId: null,
  priority: null,
  createdAt: '2026-11-03T00:00:00Z',
  updatedAt: '2026-11-03T00:00:00Z'
}
function apiFixture() {
  return {
    status: vi.fn().mockResolvedValue(connection),
    connect: vi.fn().mockResolvedValue(connection),
    disconnect: vi.fn().mockResolvedValue(undefined),
    listProjects: vi.fn().mockResolvedValue(projects),
    getProject: vi.fn().mockImplementation((ref) =>
      Promise.resolve({
        project: projects.find((project) => project.ref === ref) ?? projects[0],
        columns: [{ id: 1, name: 'To do', stateType: 'unstarted', color: '', position: 0 }],
        assignees: [{ userId: 'user-1', name: 'Alex', kind: 'member' }]
      })
    ),
    listIssues: vi.fn().mockResolvedValue([issue]),
    searchIssues: vi.fn().mockResolvedValue([]),
    getIssue: vi
      .fn()
      .mockImplementation((id) =>
        Promise.resolve(id === 43 ? { ...issue, id, title: 'New task' } : issue)
      ),
    createIssue: vi.fn().mockResolvedValue({ ...issue, id: 43, title: 'New task' }),
    updateIssue: vi
      .fn()
      .mockImplementation((_id, patch) => Promise.resolve({ ...issue, ...patch })),
    listComments: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    addComment: vi.fn().mockResolvedValue({
      id: 1,
      issueId: 42,
      kind: 'comment',
      replyToId: null,
      actorName: 'Alex',
      body: 'Checked',
      createdAt: issue.createdAt
    })
  } satisfies ItsaplanApi
}
afterEach(() => {
  cleanup()
  localStorage.clear()
})

it('connects from the native disconnected screen without persisting the key in UI storage', async () => {
  const api = apiFixture()
  api.status.mockResolvedValueOnce({ connected: false, baseUrl: null, webBaseUrl: null })
  render(<ItsaplanTasks api={api} hostKey="local" onUseIssue={vi.fn()} />)
  fireEvent.change(await screen.findByLabelText('API URL'), {
    target: { value: 'https://api.plan.test' }
  })
  fireEvent.change(screen.getByLabelText('Web URL (optional)'), {
    target: { value: 'https://plan.test' }
  })
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'secret-test-key' } })
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await screen.findByRole('button', { name: 'APP-3 Fix checkout' })
  expect(api.connect).toHaveBeenCalledWith({
    baseUrl: 'https://api.plan.test',
    webBaseUrl: 'https://plan.test',
    apiKey: 'secret-test-key'
  })
  expect(JSON.stringify(localStorage)).not.toContain('secret-test-key')
  expect(screen.queryByLabelText('API key')).toBeNull()
})

it('loads full issue context before editing, commenting and starting a workspace', async () => {
  const api = apiFixture()
  const onUseIssue = vi.fn()
  render(<ItsaplanTasks api={api} hostKey="local" onUseIssue={onUseIssue} />)
  fireEvent.click(await screen.findByRole('button', { name: 'APP-3 Fix checkout' }))
  await screen.findByText('Full task context')
  fireEvent.click(screen.getByRole('button', { name: 'Edit issue' }))
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Fixed checkout' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() =>
    expect(api.updateIssue).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ title: 'Fixed checkout' })
    )
  )
  fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'Checked' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add comment' }))
  await waitFor(() => expect(api.addComment).toHaveBeenCalledWith(42, 'Checked'))
  fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }))
  await waitFor(() =>
    expect(onUseIssue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42, description: 'Full task context' }),
      projects[0],
      connection
    )
  )
})

it('ignores a previous project response after switching to another project', async () => {
  const api = apiFixture()
  let resolveOld!: (issues: ItsaplanIssue[]) => void
  api.listIssues.mockImplementation((ref) =>
    ref === 'team.APP'
      ? new Promise((resolve) => {
          resolveOld = resolve
        })
      : Promise.resolve([
          { ...issue, projectId: 2, identifier: 'OPS-3', title: 'New project task' }
        ])
  )
  render(<ItsaplanTasks api={api} hostKey="local" onUseIssue={vi.fn()} />)
  const picker = await screen.findByRole('combobox', { name: 'Project' })
  await waitFor(() => expect(api.listIssues).toHaveBeenCalledWith('team.APP'))
  fireEvent.click(picker)
  fireEvent.click(await screen.findByRole('option', { name: 'team.OPS · Operations' }))
  await screen.findByRole('button', { name: 'OPS-3 New project task' })
  resolveOld([issue])
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'APP-3 Fix checkout' })).toBeNull()
  )
})

it('clears an old host immediately and ignores its late status response', async () => {
  const oldApi = apiFixture()
  let resolveOld!: (value: typeof connection) => void
  oldApi.status.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveOld = resolve
    })
  )
  const nextApi = apiFixture()
  nextApi.listIssues.mockResolvedValue([{ ...issue, title: 'Remote task' }])
  const { rerender } = render(<ItsaplanTasks api={oldApi} hostKey="local" onUseIssue={vi.fn()} />)
  rerender(<ItsaplanTasks api={nextApi} hostKey="remote" onUseIssue={vi.fn()} />)
  await screen.findByRole('button', { name: 'APP-3 Remote task' })
  resolveOld(connection)
  await waitFor(() => expect(oldApi.listProjects).not.toHaveBeenCalled())
  expect(screen.queryByRole('button', { name: 'APP-3 Fix checkout' })).toBeNull()
})

it('follows the comment cursor and keeps earlier comments visible', async () => {
  const api = apiFixture()
  const comment = {
    id: 1,
    issueId: 42,
    kind: 'comment',
    replyToId: null,
    actorName: 'Alex',
    body: 'First comment',
    createdAt: issue.createdAt
  }
  const cursor = { ts: issue.createdAt, id: 1 }
  api.listComments
    .mockResolvedValueOnce({ items: [comment], nextCursor: cursor })
    .mockResolvedValueOnce({
      items: [{ ...comment, id: 2, replyToId: 1, body: 'Reply comment' }],
      nextCursor: null
    })
  render(<ItsaplanTasks api={api} hostKey="local" onUseIssue={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'APP-3 Fix checkout' }))
  await screen.findByText('First comment')
  fireEvent.click(screen.getByRole('button', { name: 'Load more comments' }))
  await screen.findByText('Reply comment')
  expect(screen.getByText('First comment')).toBeTruthy()
  expect(api.listComments).toHaveBeenLastCalledWith(42, { cursor, limit: 100 })
})

it('creates an issue using its selected project and keeps failed drafts editable', async () => {
  const api = apiFixture()
  api.createIssue.mockRejectedValueOnce(new Error('Permission denied'))
  render(<ItsaplanTasks api={api} hostKey="local" onUseIssue={vi.fn()} />)
  const newIssueButton = await screen.findByRole('button', { name: 'New issue' })
  await waitFor(() => expect(newIssueButton).toBeEnabled())
  fireEvent.click(newIssueButton)
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New task' } })
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'New description' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create issue' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Title')).toHaveValue('New task')
  fireEvent.click(screen.getByRole('button', { name: 'Create issue' }))
  await waitFor(() =>
    expect(api.createIssue).toHaveBeenLastCalledWith(
      'team.APP',
      expect.objectContaining({ title: 'New task', description: 'New description', columnId: 1 })
    )
  )
  await screen.findByText('New task')
})

it('paginates the complete board locally and discloses a capped server search', async () => {
  const api = apiFixture()
  api.listIssues.mockResolvedValue(
    Array.from({ length: 51 }, (_, index) => ({
      ...issue,
      id: index + 1,
      identifier: `APP-${index + 1}`,
      title: `Board task ${index + 1}`
    }))
  )
  api.searchIssues.mockResolvedValue(
    Array.from({ length: 500 }, (_, index) => ({
      ...issue,
      id: index + 1,
      identifier: `APP-${index + 1}`,
      title: `Search match ${index + 1}`
    }))
  )
  render(<ItsaplanTasks api={api} hostKey="local" onUseIssue={vi.fn()} />)
  await screen.findByRole('button', { name: 'APP-1 Board task 1' })
  expect(screen.queryByRole('button', { name: 'APP-51 Board task 51' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByRole('button', { name: 'APP-51 Board task 51' })
  expect(api.listIssues).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByLabelText('Search issues'), { target: { value: 'payment' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await screen.findByText(
    'Showing up to 500 search matches. Refine your search to find other issues.'
  )
  expect(api.searchIssues).toHaveBeenCalledWith('team.APP', 'payment', 500)
  expect(screen.queryByRole('button', { name: 'APP-51 Board task 51' })).toBeNull()
})

it('clears the old server project when connection succeeds but its project list fails', async () => {
  const api = apiFixture()
  render(<ItsaplanTasks api={api} hostKey="local" onUseIssue={vi.fn()} />)
  await screen.findByRole('button', { name: 'APP-3 Fix checkout' })
  fireEvent.click(screen.getByRole('button', { name: 'Connection settings' }))
  api.connect.mockResolvedValueOnce({ ...connection, baseUrl: 'https://other-api.plan.test' })
  api.listProjects.mockRejectedValueOnce(new Error('Project access denied'))
  fireEvent.change(screen.getByLabelText('API URL'), {
    target: { value: 'https://other-api.plan.test' }
  })
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'new-key' } })
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await screen.findByText('Project access denied')
  expect(screen.queryByRole('button', { name: 'APP-3 Fix checkout' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  expect(screen.queryByLabelText('API key')).toBeNull()
})

it('keeps read-only issue access without offering denied edits or comments', async () => {
  const api = apiFixture()
  api.getProject.mockResolvedValue({
    project: projects[0],
    columns: [{ id: 1, name: 'To do', stateType: 'unstarted', color: '', position: 0 }],
    assignees: [],
    permissions: { work_items: { create: false, edit: false } }
  })
  render(<ItsaplanTasks api={api} hostKey="local" onUseIssue={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'APP-3 Fix checkout' }))
  await screen.findByText('Full task context')
  expect(screen.getByRole('button', { name: 'Edit issue' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Add comment' })).toBeDisabled()
  expect(screen.getByLabelText('Comment')).toBeDisabled()
})

it('attaches the full issue to a chosen existing workspace and exposes its open action', async () => {
  const api = apiFixture()
  const onAttachIssue = vi.fn().mockResolvedValue(undefined)
  const onOpenIssue = vi.fn()
  render(
    <ItsaplanTasks
      api={api}
      hostKey="local"
      onUseIssue={vi.fn()}
      workspaces={[{ id: 'workspace-1', label: 'Existing workspace' }]}
      onAttachIssue={onAttachIssue}
      onOpenIssue={onOpenIssue}
      linkedWorkspaceName={() => 'Existing workspace'}
    />
  )
  fireEvent.click(await screen.findByRole('button', { name: 'APP-3 Fix checkout' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Attach to workspace' }))
  fireEvent.click(screen.getByRole('combobox', { name: 'Workspace' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Existing workspace' }))
  fireEvent.click(screen.getByRole('button', { name: 'Attach issue' }))
  await waitFor(() =>
    expect(onAttachIssue).toHaveBeenCalledWith(issue, projects[0], connection, 'workspace-1')
  )
  fireEvent.click(screen.getByRole('button', { name: 'Open workspace: Existing workspace' }))
  expect(onOpenIssue).toHaveBeenCalledWith(issue, projects[0], connection)
})
