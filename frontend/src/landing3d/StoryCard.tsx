import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLang } from '../lib/i18n'
import { DEMO_LEAK_PSI_PER_H, leakAt, story, type SectionId } from './store'

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
