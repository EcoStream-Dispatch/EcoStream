import { useEffect, useState } from 'react'
import { asset } from '../lib/asset'
import type { Manifest } from './types'

/** frontend/public/models/manifest.json (written by models/build.sh). */
export function useManifest() {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    fetch(asset('models/manifest.json'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((m: Manifest) => alive && setManifest(m))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [])
  return { manifest, error }
}
