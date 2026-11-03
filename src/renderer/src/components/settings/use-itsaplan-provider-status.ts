import { useEffect, useMemo, useState } from 'react'
import { createItsaplanRuntimeClient } from '@/runtime/runtime-itsaplan-client'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

export function useItsaplanProviderStatus(target: RuntimeClientTarget, key: string) {
  const api = useMemo(() => createItsaplanRuntimeClient(target), [target])
  const [result, setResult] = useState({ key: '', connected: false, unavailable: false })
  useEffect(() => {
    let cancelled = false
    void api
      .status()
      .then((status) => {
        if (!cancelled) {
          setResult({ key, connected: status.connected, unavailable: false })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ key, connected: false, unavailable: true })
        }
      })
    return () => {
      cancelled = true
    }
  }, [api, key])
  return useMemo(
    () => ({
      connected: result.key === key && result.connected,
      checking: result.key !== key,
      unavailable: result.key === key && result.unavailable
    }),
    [key, result]
  )
}
