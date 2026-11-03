import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ITSAPLAN_PLANNING_RUNTIME_CAPABILITY,
  ITSAPLAN_RUNTIME_CAPABILITY
} from '../../../shared/itsaplan/types'
import { createItsaplanRuntimeClient } from './runtime-itsaplan-client'

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
  baseUrl: 'https://old.example',
  webBaseUrl: 'https://old.example'
}
beforeEach(() => {
  vi.clearAllMocks()
  assertCapability.mockResolvedValue(undefined)
  vi.stubGlobal('window', { api: { itsaplan: { request: localRequest } } })
})
afterEach(() => vi.unstubAllGlobals())

describe('remote planning capability and host fence', () => {
  it('negotiates planning separately from existing issues and sends the remembered server', async () => {
    callRpc.mockResolvedValueOnce(status).mockResolvedValueOnce([]).mockResolvedValueOnce({ id: 1 })
    const target = { kind: 'environment', environmentId: 'host-2' } as const
    const api = createItsaplanRuntimeClient(target)
    await api.status()
    if (!api.planning) {
      throw new Error('Planning API missing')
    }
    await api.planning.listViews('p')
    expect(assertCapability).toHaveBeenLastCalledWith(
      'host-2',
      ITSAPLAN_PLANNING_RUNTIME_CAPABILITY,
      expect.any(String)
    )
    expect(callRpc).toHaveBeenLastCalledWith(
      target,
      'itsaplan.planning',
      { expectedBaseUrl: status.baseUrl, operation: 'listViews', args: { projectRef: 'p' } },
      { timeoutMs: 35000 }
    )
    await api.getIssue(1)
    expect(assertCapability).toHaveBeenLastCalledWith(
      'host-2',
      ITSAPLAN_RUNTIME_CAPABILITY,
      expect.any(String)
    )
    expect(localRequest).not.toHaveBeenCalled()
  })
  it('rejects unsupported planning without RPC or local fallback', async () => {
    callRpc.mockResolvedValueOnce(status)
    const api = createItsaplanRuntimeClient({ kind: 'environment', environmentId: 'old-host' })
    await api.status()
    callRpc.mockClear()
    assertCapability.mockRejectedValueOnce(new Error('Update the remote host'))
    if (!api.planning) {
      throw new Error('Planning API missing')
    }
    await expect(api.planning.listViews('p')).rejects.toThrow('Update')
    expect(callRpc).not.toHaveBeenCalled()
    expect(localRequest).not.toHaveBeenCalled()
  })
  it('retains each view server after another view switches', async () => {
    callRpc
      .mockResolvedValueOnce(status)
      .mockResolvedValueOnce({ ...status, baseUrl: 'https://new.example' })
      .mockResolvedValueOnce([])
    const target = { kind: 'environment', environmentId: 'host-2' } as const
    const oldView = createItsaplanRuntimeClient(target)
    const newView = createItsaplanRuntimeClient(target)
    await oldView.status()
    await newView.status()
    if (!oldView.planning) {
      throw new Error('Planning API missing')
    }
    await oldView.planning.listViews('p')
    expect(callRpc).toHaveBeenLastCalledWith(
      target,
      'itsaplan.planning',
      { expectedBaseUrl: status.baseUrl, operation: 'listViews', args: { projectRef: 'p' } },
      { timeoutMs: 35000 }
    )
  })
  it('rejects an invalid source owner without routing', () => {
    const invalid = JSON.parse(
      '{"kind":"task-source","provider":"itsaplan","projectId":"p","hostId":"invalid-owner"}'
    )
    expect(() => createItsaplanRuntimeClient(invalid)).toThrow('host')
    expect(callRpc).not.toHaveBeenCalled()
    expect(localRequest).not.toHaveBeenCalled()
  })
})
