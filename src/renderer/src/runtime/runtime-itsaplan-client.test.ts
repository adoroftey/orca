import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createItsaplanRuntimeClient } from './runtime-itsaplan-client'
import { ITSAPLAN_RUNTIME_CAPABILITY } from '../../../shared/itsaplan/types'

const { callRpc, assertCapability, localRequest } = vi.hoisted(() => ({
  callRpc: vi.fn(),
  assertCapability: vi.fn(),
  localRequest: vi.fn()
}))

vi.mock('./runtime-rpc-client', () => ({
  callRuntimeRpc: callRpc,
  assertRuntimeEnvironmentCapability: assertCapability
}))

const status = {
  connected: true,
  baseUrl: 'https://api.plan.example',
  webBaseUrl: 'https://plan.example'
}

beforeEach(() => {
  vi.clearAllMocks()
  assertCapability.mockResolvedValue(undefined)
  vi.stubGlobal('window', { api: { itsaplan: { request: localRequest } } })
})
afterEach(() => vi.unstubAllGlobals())

describe('Itsaplan host-scoped runtime client', () => {
  it('keeps remote requests on the named host with the server identity from status', async () => {
    callRpc.mockResolvedValueOnce(status).mockResolvedValueOnce({ id: 42 })
    const target = { kind: 'environment', environmentId: 'host-2' } as const
    const api = createItsaplanRuntimeClient(target)
    await api.status()
    await api.getIssue(42)
    expect(localRequest).not.toHaveBeenCalled()
    expect(assertCapability).toHaveBeenCalledWith(
      'host-2',
      ITSAPLAN_RUNTIME_CAPABILITY,
      expect.any(String)
    )
    expect(callRpc).toHaveBeenLastCalledWith(
      target,
      'itsaplan.getIssue',
      {
        issueId: 42,
        expectedBaseUrl: status.baseUrl
      },
      { timeoutMs: 35_000 }
    )
  })

  it('does not fall back to local credentials when a remote host lacks support', async () => {
    assertCapability.mockRejectedValue(new Error('Update the remote host'))
    const api = createItsaplanRuntimeClient({ kind: 'environment', environmentId: 'older-host' })
    await expect(api.status()).rejects.toThrow('Update')
    expect(callRpc).not.toHaveBeenCalled()
    expect(localRequest).not.toHaveBeenCalled()
  })

  it('gives each local view its own server expectation', async () => {
    localRequest
      .mockResolvedValueOnce(status)
      .mockResolvedValueOnce({ ...status, baseUrl: 'https://new.example' })
      .mockResolvedValueOnce({ id: 42 })
    const oldView = createItsaplanRuntimeClient({ kind: 'local' })
    const newView = createItsaplanRuntimeClient({ kind: 'local' })
    await oldView.status()
    await newView.status()
    await oldView.updateIssue(42, { title: 'Old view' })
    expect(localRequest).toHaveBeenLastCalledWith('updateIssue', {
      issueId: 42,
      updates: { title: 'Old view' },
      expectedBaseUrl: status.baseUrl
    })
  })

  it('requires connection discovery before task operations', async () => {
    const api = createItsaplanRuntimeClient({ kind: 'local' })
    await expect(api.updateIssue(42, { title: 'Unknown scope' })).rejects.toThrow('refresh Tasks')
    expect(localRequest).not.toHaveBeenCalled()
  })
})

it('refuses an invalid source owner instead of using local credentials', () => {
  const invalidSource = JSON.parse(
    '{"kind":"task-source","provider":"itsaplan","projectId":"project-1","hostId":"invalid-owner"}'
  )
  expect(() => createItsaplanRuntimeClient(invalidSource)).toThrow('host')
  expect(localRequest).not.toHaveBeenCalled()
  expect(callRpc).not.toHaveBeenCalled()
})
