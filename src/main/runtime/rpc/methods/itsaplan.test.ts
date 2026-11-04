import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RuntimeRpcEnvelopeSchema } from '../../../../shared/runtime-rpc-envelope'
import { ItsaplanPlanningParams } from '../../../../shared/rpc-contract/itsaplan-planning-params'
import { dispatchItsaplanRequest } from '../../../itsaplan/request'
import { ITSAPLAN_METHODS } from './itsaplan'
import type { RpcContext } from '../core'

vi.mock('../../../itsaplan/request', () => ({ dispatchItsaplanRequest: vi.fn() }))

const planning = ITSAPLAN_METHODS[0]
const unusedContext: RpcContext = expect.anything()
const base = { expectedBaseUrl: 'https://example.com' }
const voidOperations = [
  { operation: 'deleteInitiative', args: { id: 1 } },
  { operation: 'deleteView', args: { id: 1 } },
  { operation: 'deleteDashboard', args: { id: 1 } },
  { operation: 'favoriteView', args: { id: 1, favorite: true } },
  { operation: 'hideView', args: { id: 1, hidden: true } }
]

describe('itsaplan planning RPC', () => {
  beforeEach(() => vi.resetAllMocks())

  it.each(voidOperations)('serializes a valid response for $operation', async (operation) => {
    vi.mocked(dispatchItsaplanRequest).mockResolvedValue(undefined)
    const params = ItsaplanPlanningParams.parse({ ...base, ...operation })
    const result = await planning.handler(params, unusedContext)
    const frame = JSON.parse(
      JSON.stringify({ id: '1', ok: true, result, _meta: { runtimeId: 'r' } })
    )
    expect(RuntimeRpcEnvelopeSchema.parse(frame)).toMatchObject({ ok: true, result: null })
    expect(dispatchItsaplanRequest).toHaveBeenCalledWith({ method: 'planning', params })
  })

  it('preserves object results and propagates failures', async () => {
    const params = ItsaplanPlanningParams.parse({
      ...base,
      operation: 'listViews',
      args: { projectRef: 'P' }
    })
    const payload = [{ id: 1, extra: { future: true } }]
    vi.mocked(dispatchItsaplanRequest)
      .mockResolvedValueOnce(payload)
      .mockRejectedValueOnce(new Error('failed'))
    expect(await planning.handler(params, unusedContext)).toEqual(payload)
    await expect(planning.handler(params, unusedContext)).rejects.toThrow('failed')
    expect(
      ItsaplanPlanningParams.safeParse({ ...base, operation: 'deleteView', args: {} }).success
    ).toBe(false)
  })
})

describe('local-only OAuth fence', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects OAuth connect before dispatch', async () => {
    const method = ITSAPLAN_METHODS.find((entry) => entry.name === 'itsaplan.connect')!
    await expect(async () =>
      method.handler(
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: This intentionally exercises runtime rejection of a remote OAuth request.
        { baseUrl: 'https://example.com', authMethod: 'oauth' } as never,
        unusedContext
      )
    ).rejects.toThrow('local desktop')
    expect(dispatchItsaplanRequest).not.toHaveBeenCalled()
  })

  it('rejects remote cancellation before dispatch', async () => {
    const method = ITSAPLAN_METHODS.find((entry) => entry.name === 'itsaplan.cancelConnect')!
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: This intentionally exercises runtime rejection of remote cancellation.
    await expect(async () => method.handler(undefined as never, unusedContext)).rejects.toThrow(
      'local desktop'
    )
    expect(dispatchItsaplanRequest).not.toHaveBeenCalled()
  })
})
