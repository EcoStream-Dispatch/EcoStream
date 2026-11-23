import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { asset } from '../lib/asset'
import { useLang } from '../lib/i18n'

/**
 * Branded loading screen for the 3D landing page: logo, progress bar, "Skip to app".
 * `done` fades it out. The bar follows real progress when there is some, and
 * otherwise eases towards 90% until the first frame is drawn.
 */
export default function Loader({ done, progress = 0 }: { done: boolean; progress?: number }) {
  const { t } = useLang()
  const [fake, setFake] = useState(0)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (done) return
    const id = window.setInterval(() => setFake((f) => f + (90 - f) * 0.08), 80)
    return () => window.clearInterval(id)
  }, [done])

  useEffect(() => {
    if (!done) return
    const id = window.setTimeout(() => setGone(true), 700)
    return () => window.clearTimeout(id)
  }, [done])

  if (gone) return null
  const pct = done ? 100 : Math.round(Math.max(fake, progress))

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-6 transition-opacity duration-700 ${
        done ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      role="status"
      aria-live="polite"
    >
      <img src={asset('logo-mark.png')} alt="" className="h-20 w-20 animate-pulse object-contain" />
      <p className="mt-4 font-heading text-2xl font-extrabold uppercase tracking-wide">
        <span className="text-green-700">Eco</span>
        <span className="text-navy-900">stream</span>
      </p>
      <p className="mt-1 font-heading text-[11px] font-bold uppercase tracking-[0.3em] text-green-700">
        Predict · Protect · Perform
      </p>
      <div className="mt-8 h-1.5 w-64 max-w-full overflow-hidden rounded-full bg-green-50 ring-1 ring-green-500/20">
        <div className="h-full rounded-full bg-green-700 transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-sm text-navy-700">
        {t('l3d.loading')} <span className="tabular-nums">{pct}%</span>
      </p>
      <Link
        to="/login"
        className="mt-8 inline-flex min-h-[44px] items-center rounded-lg px-4 text-sm font-semibold text-green-700 underline-offset-4 hover:underline"
      >
        {t('l3d.skip')} →
      </Link>
    </div>
  )
}
