import {
  createItsaplanScopedTransportApi,
  type ItsaplanCaller
} from '../../../../shared/itsaplan/transport'
import type { ItsaplanHostApi } from '../../../../preload/api/itsaplan-api'
import {
  ITSAPLAN_RUNTIME_CAPABILITY,
  ITSAPLAN_UPDATE_REQUIRED
} from '../../../../shared/itsaplan/types'
import { assertRuntimeEnvironmentCapability } from '../../runtime/runtime-rpc-client'
import { callRuntimeResult } from './web-runtime-calls'
import { requireActiveEnvironment } from './web-runtime-session'

export function createWebItsaplanApi(): ItsaplanHostApi {
  const request: ItsaplanCaller = async <T>(method: string, params?: unknown): Promise<T> => {
    const environmentId = requireActiveEnvironment().id
    await assertRuntimeEnvironmentCapability(
      environmentId,
      ITSAPLAN_RUNTIME_CAPABILITY,
      ITSAPLAN_UPDATE_REQUIRED
    )
    return callRuntimeResult<T>(`itsaplan.${method}`, params, 35_000)
  }
  return { ...createItsaplanScopedTransportApi(request), request }
}
