import type { ItsaplanApi } from '../../../shared/itsaplan/types'
import {
  ITSAPLAN_RUNTIME_CAPABILITY,
  ITSAPLAN_PLANNING_RUNTIME_CAPABILITY,
  ITSAPLAN_UPDATE_REQUIRED
} from '../../../shared/itsaplan/types'
import { createItsaplanScopedTransportApi } from '../../../shared/itsaplan/transport'
import type { RuntimeClientTarget } from '../../../shared/runtime-client-target'
import type { TaskSourceContext } from '../../../shared/task-source-context'
import { parseRoutableExecutionHostId } from '../../../shared/execution-host'
import { taskSourceRuntimeTarget } from '@/lib/task-source-runtime-target'
import { assertRuntimeEnvironmentCapability, callRuntimeRpc } from './runtime-rpc-client'

export function createItsaplanRuntimeClient(
  source: TaskSourceContext | RuntimeClientTarget
): ItsaplanApi {
  if (source.kind === 'task-source') {
    const owner = parseRoutableExecutionHostId(source.hostId)
    if (!owner || owner.kind === 'ssh') {
      throw new Error('The Itsaplan source host is unavailable.')
    }
  }
  const target = source.kind === 'task-source' ? taskSourceRuntimeTarget(source) : source
  if (target.kind === 'local') {
    if (typeof window.api.itsaplan?.request !== 'function') {
      throw new Error(ITSAPLAN_UPDATE_REQUIRED)
    }
    return createItsaplanScopedTransportApi(window.api.itsaplan.request)
  }
  return createItsaplanScopedTransportApi(
    async <T>(method: string, params?: unknown): Promise<T> => {
      await assertRuntimeEnvironmentCapability(
        target.environmentId,
        method === 'planning' ? ITSAPLAN_PLANNING_RUNTIME_CAPABILITY : ITSAPLAN_RUNTIME_CAPABILITY,
        ITSAPLAN_UPDATE_REQUIRED
      )
      return callRuntimeRpc<T>(target, `itsaplan.${method}`, params, { timeoutMs: 35_000 })
    }
  )
}
