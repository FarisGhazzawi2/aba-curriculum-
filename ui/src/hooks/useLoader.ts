import { useCallback, useEffect, useState } from 'react'

interface Settled<T> {
  load: () => Promise<T>
  version: number
  data?: T
  error?: unknown
}

export interface LoaderState<T> {
  data: T | undefined
  error: unknown
  isLoading: boolean
  reload: () => void
}

/**
 * Runs `load` on mount, whenever `load` changes (wrap it in useCallback), and on reload().
 * Loading is derived from whether the latest request has settled, so the indicator shows
 * immediately when a request starts (NFR5). Results of superseded requests are dropped.
 */
export function useLoader<T>(load: () => Promise<T>): LoaderState<T> {
  const [version, setVersion] = useState(0)
  const [settled, setSettled] = useState<Settled<T> | null>(null)

  useEffect(() => {
    let isCurrent = true
    load().then(
      (data) => {
        if (isCurrent) setSettled({ load, version, data })
      },
      (error: unknown) => {
        if (isCurrent) setSettled({ load, version, error })
      },
    )
    return () => {
      isCurrent = false
    }
  }, [load, version])

  const reload = useCallback(() => setVersion((current) => current + 1), [])
  const isLoading = settled === null || settled.load !== load || settled.version !== version

  return {
    data: isLoading ? undefined : settled.data,
    error: isLoading ? undefined : settled.error,
    isLoading,
    reload,
  }
}
