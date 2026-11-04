import { describe, expect, it, vi } from 'vitest'
import { createItsaplanScopedTransportApi } from './transport'

describe('scoped planning transport', () => {
  it('refuses a planning call before status without invoking the caller', async () => {
    const call = vi.fn()
    const api = createItsaplanScopedTransportApi(call)
    await expect(api.planning!.listViews('project')).rejects.toThrow()
    expect(call).not.toHaveBeenCalled()
  })
  it('fences planning calls to the server returned by status', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ connected: true, baseUrl: 'https://plan.example/root' })
      .mockResolvedValueOnce([])
    const api = createItsaplanScopedTransportApi(call)
    await api.status()
    await expect(api.planning!.listViews('project')).resolves.toEqual([])
    expect(call).toHaveBeenLastCalledWith('planning', {
      expectedBaseUrl: 'https://plan.example/root',
      operation: 'listViews',
      args: { projectRef: 'project' }
    })
  })
})
