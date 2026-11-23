import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLang } from '../lib/i18n'
import { journeyStep } from './Journey'
import { DEMO_LEAK_PSI_PER_H, DEMO_RECOMMENDED_PSI, heatNow, heatState, hotLeakAt, leakAt, story, type SectionId } from './store'

/**
 * One story section: tall (so the 3D scene has scroll room) with a sticky text card.
 * Desktop: card on the left, 3D on the right. Phones: card at the bottom.
 * The card fades in while the section is on screen.
 */
export function StorySection({ id, height = '220vh', children }: { id: SectionId; height?: string; children: ReactNode }) {
  const card = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const p = story.progress[id]
      // in from 5% to 20%, out from 85% to 98%
      const a = Math.min(1, Math.max(0, (p - 0.05) / 0.15)) * (1 - Math.min(1, Math.max(0, (p - 0.85) / 0.13)))
      if (card.current) {
        card.current.style.opacity = String(a)
        card.current.style.transform = `translateY(${(1 - a) * 24}px)`
        card.current.style.visibility = a < 0.01 ? 'hidden' : 'visible'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [id])

  return (
    <section data-story={id} className="relative" style={{ height }}>
      <div className="sticky top-0 flex h-[100svh] items-end px-4 pb-6 md:items-center md:pb-0">
        <div ref={card} className="mx-auto w-full max-w-6xl" style={{ opacity: 0, visibility: 'hidden' }}>
          <div className="max-w-md rounded-2xl bg-white/95 p-4 shadow-2xl ring-1 ring-navy-900/5 md:p-7">{children}</div>
        </div>
      </div>
    </section>
  )
}

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="font-heading text-[11px] font-bold uppercase tracking-[0.25em] text-green-700">{children}</p>
}

export function Title({ children }: { children: ReactNode }) {
  return <h2 className="mt-1.5 text-xl font-extrabold leading-tight text-navy-900 md:mt-2 md:text-3xl">{children}</h2>
}

export function Body({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-navy-700 md:mt-3 md:text-base">{children}</p>
}

/** Live readout for the slow-leak scene: corrected pressure, rate and the countdown. */
export function LeakReadout() {
  const { t } = useLang()
  const [v, setV] = useState(() => leakAt(0))
  useEffect(() => {
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      if (now - last > 80) {
        last = now
        setV(leakAt(story.progress.leak))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const h = Math.floor(v.hoursLeft)
  const m = Math.round((v.hoursLeft - h) * 60)

  return (
    <div className="mt-3 md:mt-5">
      <div className="rounded-xl bg-warning px-4 py-3 text-navy-900 md:p-4">
        <p className="font-heading text-[11px] font-bold uppercase tracking-widest">{t('l3d.leak.unsafe')}</p>
        <p className="font-heading text-3xl font-extrabold tabular-nums md:text-4xl">
          {h} h {String(m).padStart(2, '0')} min
        </p>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm md:mt-3">
        <div className="rounded-lg bg-gray-50 px-3 py-2 md:p-3">
          <dt className="text-xs text-navy-700">{t('l3d.leak.pressure')}</dt>
          <dd className="font-semibold tabular-nums">{v.psi.toFixed(1)} psi</dd>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2 md:p-3">
          <dt className="text-xs text-navy-700">{t('l3d.leak.rate')}</dt>
          <dd className="font-semibold">{DEMO_LEAK_PSI_PER_H} psi / hour</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-navy-700">
        {t('l3d.leak.ff', { m: v.minutesShown })} · {t('l3d.demo')}
      </p>
    </div>
  )
}

/** Two tiny charts: gauge vs corrected pressure for the hot tyre and the leaking tyre. */
function MiniChart({ kind, h }: { kind: 'hot' | 'leak'; h: number }) {
  const W = 150
  const H = 64
  const lo = 100
  const hi = 145
  const y = (psi: number) => H - ((psi - lo) / (hi - lo)) * H
  const pts = Array.from({ length: 31 }, (_, i) => (i / 30) * h)
  const line = (f: (v: ReturnType<typeof hotLeakAt>) => number) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${((p / 1) * W).toFixed(1)},${y(f(hotLeakAt(p))).toFixed(1)}`).join(' ')
  const tyre = (v: ReturnType<typeof hotLeakAt>) => (kind === 'hot' ? v.hot : v.leak)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" aria-hidden>
      <line x1={0} x2={W} y1={y(DEMO_RECOMMENDED_PSI)} y2={y(DEMO_RECOMMENDED_PSI)} stroke="#0B1E36" strokeOpacity={0.12} strokeDasharray="3 3" />
      <path d={line((v) => tyre(v).gauge)} fill="none" stroke="#0B1E36" strokeWidth={2} strokeLinecap="round" />
      <path d={line((v) => tyre(v).corrected)} fill="none" stroke={kind === 'leak' ? '#E0A100' : '#5C9A35'} strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  )
}

/** Drag-to-heat slider + live comparison for the "hot is not a leak" scene. */
export function HotLeakPanel() {
  const { t } = useLang()
  const [h, setH] = useState(0)
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      if (now - last > 60) {
        last = now
        setH(heatNow())
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      heatState.user = null
    }
  }, [])
  const v = hotLeakAt(h)

  return (
    <div className="mt-3 md:mt-5">
      <label className="block">
        <span className="flex items-baseline justify-between text-sm font-semibold text-navy-900">
          {t('l3d.hot.slider')}
          <span className="tabular-nums text-navy-700">
            {Math.round(v.hot.temp)} °C · {v.minutes} min
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(h * 1000)}
          onChange={(e) => {
            heatState.user = Number(e.target.value) / 1000
            setTouched(true)
          }}
          className="mt-2 h-11 w-full cursor-pointer accent-green-700"
          aria-label={t('l3d.hot.slider')}
        />
      </label>
      {!touched && <p className="-mt-1 text-xs text-navy-700">{t('l3d.hot.hint')}</p>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(['hot', 'leak'] as const).map((k) => {
          const alarm = k === 'leak' && v.alert
          const tyre = k === 'hot' ? v.hot : v.leak
          return (
            <div key={k} className={`rounded-xl p-2.5 ring-1 ${alarm ? 'bg-amber-50 ring-warning' : 'bg-gray-50 ring-gray-200'}`}>
              <p className="font-heading text-[11px] font-extrabold uppercase tracking-wider text-navy-900">
                {k === 'hot' ? t('l3d.hot.hot') : t('l3d.hot.leak')}
              </p>
              <MiniChart kind={k} h={h} />
              <p className="text-[11px] text-navy-700">
                {t('l3d.hot.gauge')} <b className="tabular-nums text-navy-900">{tyre.gauge.toFixed(1)}</b> ·{' '}
                {t('l3d.hot.corr')} <b className={`tabular-nums ${k === 'leak' ? 'text-amber-800' : 'text-green-700'}`}>{tyre.corrected.toFixed(1)}</b>
              </p>
              <p className={`mt-1 rounded px-1.5 py-0.5 text-center text-[11px] font-bold ${alarm ? 'bg-warning text-navy-900' : 'bg-green-50 text-green-700'}`}>
                {alarm ? t('l3d.hot.alert') : k === 'hot' ? t('l3d.hot.noAlarm') : t('l3d.hot.watching')}
              </p>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-navy-700">
        {t('l3d.hot.legend')} · {t('l3d.demo')}
      </p>
    </div>
  )
}

/** Step list for the signal journey; the current step lights up as you scroll. */
export function JourneySteps() {
  const { t } = useLang()
  const [step, setStep] = useState(0)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      setStep(journeyStep(story.progress.journey))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const keys = ['l3d.journey.s0', 'l3d.journey.s1', 'l3d.journey.s2', 'l3d.journey.s3', 'l3d.journey.s4'] as const
  return (
    <ol className="mt-3 space-y-1.5 md:mt-4 md:space-y-2">
      {keys.map((k, i) => (
        <li key={k} className={`flex items-center gap-3 text-sm transition-opacity ${i <= step ? 'opacity-100' : 'opacity-40'}`}>
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-heading text-xs font-bold ${
              i < step ? 'bg-green-700 text-white' : i === step ? 'bg-green-300 text-navy-900 ring-4 ring-green-300/30' : 'bg-gray-100 text-navy-700'
            }`}
          >
            {i + 1}
          </span>
          <span className={i === step ? 'font-semibold text-navy-900' : 'text-navy-700'}>{t(k)}</span>
        </li>
      ))}
    </ol>
  )
}
