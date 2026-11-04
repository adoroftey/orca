import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dispatchItsaplanRequest } from './request'

const { forServer, updateIssue } = vi.hoisted(() => ({ forServer: vi.fn(), updateIssue: vi.fn() }))
vi.mock('./connection', () => ({ itsaplanConnection: { forServer } }))

beforeEach(() => {
  vi.clearAllMocks()
  forServer.mockReturnValue({ updateIssue })
  updateIssue.mockResolvedValue({ id: 42 })
})

describe('Itsaplan IPC/RPC request admission', () => {
  it('refuses data requests without an explicit server expectation', async () => {
    await expect(
      dispatchItsaplanRequest({
        method: 'updateIssue',
        params: { issueId: 42, updates: { title: 'Title' } }
      })
    ).rejects.toThrow('Invalid Itsaplan request')
    expect(forServer).not.toHaveBeenCalled()
  })

  it('rejects unregistered operations and malformed issue ids before accessing a connection', async () => {
    await expect(dispatchItsaplanRequest({ method: 'constructor' })).rejects.toThrow(
      'Invalid Itsaplan request'
    )
    await expect(
      dispatchItsaplanRequest({
        method: 'getIssue',
        params: { expectedBaseUrl: 'https://plan.example', issueId: -1 }
      })
    ).rejects.toThrow('Invalid Itsaplan request')
    expect(forServer).not.toHaveBeenCalled()
  })

  it('passes the server expectation and explicit null fields to the connection boundary', async () => {
    await dispatchItsaplanRequest({
      method: 'updateIssue',
      params: {
        expectedBaseUrl: 'https://old.example',
        issueId: 42,
        updates: { assigneeUserId: null, priority: null }
      }
    })
    expect(forServer).toHaveBeenCalledWith('https://old.example')
    expect(updateIssue).toHaveBeenCalledWith(42, { assigneeUserId: null, priority: null })
  })
})
