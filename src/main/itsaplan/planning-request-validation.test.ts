import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import { ItsaplanPlanningParams } from '../../shared/rpc-contract/itsaplan-planning-params'
import { dispatchItsaplanRequest } from './request'

const { forServer, updateView } = vi.hoisted(() => ({ forServer: vi.fn(), updateView: vi.fn() }))
vi.mock('./connection', () => ({ itsaplanConnection: { forServer } }))

const expectedBaseUrl = 'https://old.example'
const fixtures: z.infer<typeof ItsaplanPlanningParams>[] = [
  { expectedBaseUrl, operation: 'capabilities', args: {} },
  {
    expectedBaseUrl,
    operation: 'listInitiatives',
    args: { projectRef: 'p', options: { page: 1, pageSize: 10 } }
  },
  { expectedBaseUrl, operation: 'getInitiative', args: { id: 1 } },
  {
    expectedBaseUrl,
    operation: 'createInitiative',
    args: { projectRef: 'p', input: { title: 'Title' } }
  },
  { expectedBaseUrl, operation: 'updateInitiative', args: { id: 1, updates: { title: 'New' } } },
  { expectedBaseUrl, operation: 'deleteInitiative', args: { id: 1 } },
  { expectedBaseUrl, operation: 'initiativeFeed', args: { id: 1, options: { limit: 10 } } },
  { expectedBaseUrl, operation: 'listViews', args: { projectRef: 'p' } },
  {
    expectedBaseUrl,
    operation: 'createView',
    args: { projectRef: 'p', input: { name: 'View', isPrivate: true } }
  },
  { expectedBaseUrl, operation: 'updateView', args: { id: 1, updates: { name: 'New' } } },
  { expectedBaseUrl, operation: 'deleteView', args: { id: 1 } },
  { expectedBaseUrl, operation: 'favoriteView', args: { id: 1, favorite: true } },
  { expectedBaseUrl, operation: 'hideView', args: { id: 1, hidden: false } },
  { expectedBaseUrl, operation: 'publishView', args: { id: 1 } },
  { expectedBaseUrl, operation: 'reorderViews', args: { projectRef: 'p', orderedIds: [1, 2] } },
  { expectedBaseUrl, operation: 'arrangeViewTabs', args: { projectRef: 'p', orderedIds: [1, 2] } },
  { expectedBaseUrl, operation: 'listDashboards', args: { projectRef: 'p' } },
  {
    expectedBaseUrl,
    operation: 'createDashboard',
    args: { projectRef: 'p', input: { name: 'Dashboard' } }
  },
  { expectedBaseUrl, operation: 'updateDashboard', args: { id: 1, updates: { name: 'New' } } },
  { expectedBaseUrl, operation: 'deleteDashboard', args: { id: 1 } },
  {
    expectedBaseUrl,
    operation: 'reorderDashboards',
    args: { projectRef: 'p', orderedIds: [1, 2] }
  },
  { expectedBaseUrl, operation: 'analytics', args: { projectRef: 'p', kind: 'stats' } }
]

beforeEach(() => {
  vi.clearAllMocks()
  forServer.mockReturnValue({ planning: { updateView } })
  updateView.mockResolvedValue({ id: 1 })
})

describe('planning request admission and server fence', () => {
  it.each(fixtures)('accepts the valid $operation contract', (params) => {
    expect(ItsaplanPlanningParams.safeParse(params).success).toBe(true)
  })
  it.each([
    { operation: 'constructor', args: {}, expectedBaseUrl },
    {
      operation: 'listViews',
      args: { projectRef: 'p', url: 'https://evil.example' },
      expectedBaseUrl
    },
    { operation: 'listViews', args: { projectRef: 'p' } },
    { operation: 'getInitiative', args: { id: -1 }, expectedBaseUrl },
    { operation: 'reorderViews', args: { projectRef: 'p', orderedIds: [0] }, expectedBaseUrl },
    {
      operation: 'listInitiatives',
      args: { projectRef: 'p', options: { pageSize: 1000000 } },
      expectedBaseUrl
    },
    { operation: 'initiativeFeed', args: { id: 1, options: { limit: 1000000 } }, expectedBaseUrl },
    {
      operation: 'updateInitiative',
      args: { id: 1, updates: { unexpected: true } },
      expectedBaseUrl
    },
    { operation: 'updateView', args: { id: 1, updates: { isPrivate: true } }, expectedBaseUrl }
  ])('rejects malformed planning input %# before connection', async (params) => {
    expect(ItsaplanPlanningParams.safeParse(params).success).toBe(false)
    await expect(dispatchItsaplanRequest({ method: 'planning', params })).rejects.toThrow()
    expect(forServer).not.toHaveBeenCalled()
  })
  it('selects the expected server before a planning mutation', async () => {
    await dispatchItsaplanRequest({
      method: 'planning',
      params: {
        expectedBaseUrl,
        operation: 'updateView',
        args: { id: 1, updates: { name: 'New' } }
      }
    })
    expect(forServer).toHaveBeenCalledWith(expectedBaseUrl)
    expect(updateView).toHaveBeenCalledWith(1, { name: 'New' })
    expect(forServer.mock.invocationCallOrder[0]).toBeLessThan(
      updateView.mock.invocationCallOrder[0]
    )
  })
  it('does not mutate when the expected server is rejected', async () => {
    forServer.mockImplementation(() => {
      throw new Error('server changed')
    })
    await expect(
      dispatchItsaplanRequest({
        method: 'planning',
        params: {
          expectedBaseUrl,
          operation: 'updateView',
          args: { id: 1, updates: { name: 'New' } }
        }
      })
    ).rejects.toThrow('server changed')
    expect(updateView).not.toHaveBeenCalled()
  })
})
