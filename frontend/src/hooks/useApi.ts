import { useCallback, useEffect, useState } from 'react'

/**
 * Load data from a service function and track loading / error.
 *
 *   const { data, loading, error, reload } = useApi(() => getTrucks(), [])
 *
 * `deps` works like useEffect's dependency list: when it changes, we load again.
 */
export function useApi<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableLoad = useCallback(load, deps)

  useEffect(() => {
    let cancelled = false // ignore results if the page changed meanwhile
    setLoading(true)
    stableLoad()
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [stableLoad, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { data, error, loading, reload }
}
