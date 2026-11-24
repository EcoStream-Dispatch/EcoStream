import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Package, Truck, UserRound, type LucideIcon } from 'lucide-react'
import { useLang } from '../lib/i18n'
import { PILLARS } from '../pages/LandingPage'
import { story, type SectionId } from './store'
import { PhotoPlate } from './PhotoHero'

/*
 * HTML for the last story sections: the five pillars list, the Owner / Driver / Shipper
 * tilt cards, and the sunrise finale with Login and Book a demo.
 */

/** Fade a block in and out with its section's scroll progress (like StorySection). */
function useSectionFade(id: SectionId, inAt = 0.08, outAt = 0.86) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const p = story.progress[id]
      const a = Math.min(1, Math.max(0, (p - inAt) / 0.14)) * (1 - Math.min(1, Math.max(0, (p - outAt) / 0.12)))
      if (ref.current) {
        ref.current.style.opacity = String(a)
        ref.current.style.transform = `translateY(${(1 - a) * 24}px)`
        ref.current.style.visibility = a < 0.01 ? 'hidden' : 'visible'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [id, inAt, outAt])
  return ref
}

export function PillarsList() {
  return (
    <ul className="mt-3 space-y-2 md:mt-4">
      {PILLARS.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <Icon size={18} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-navy-900">{title}</span>
            <span className="hidden text-xs leading-snug text-navy-700 md:block">{text}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** A card that tilts towards the pointer (CSS 3D), with a soft light spot. */
function TiltCard({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse') return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.transform = `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateZ(0)`
    el.style.setProperty('--mx', `${(x + 0.5) * 100}%`)
    el.style.setProperty('--my', `${(y + 0.5) * 100}%`)
  }
  const reset = () => {
    if (ref.current) ref.current.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg)'
  }
  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={`relative h-full overflow-hidden rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-navy-900/5 transition-transform duration-200 ease-out md:p-6 ${
        disabled ? 'opacity-80' : ''
      }`}
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: 'radial-gradient(circle at var(--mx,50%) var(--my,0%), rgba(140,193,82,0.22), transparent 55%)' }}
        aria-hidden
      />
      <div className="relative">{children}</div>
    </div>
  )
}

const ROLES: { icon: LucideIcon; title: 'l3d.roles.owner' | 'l3d.roles.driver' | 'l3d.roles.shipper'; text: 'l3d.roles.ownerText' | 'l3d.roles.driverText' | 'l3d.roles.shipperText'; to?: string }[] = [
  { icon: Truck, title: 'l3d.roles.owner', text: 'l3d.roles.ownerText', to: '/login' },
  { icon: UserRound, title: 'l3d.roles.driver', text: 'l3d.roles.driverText', to: '/login' },
  { icon: Package, title: 'l3d.roles.shipper', text: 'l3d.roles.shipperText' },
]

export function RolesSection() {
  const { t } = useLang()
  const ref = useSectionFade('roles')
  return (
    <section data-story="roles" className="relative" style={{ height: '200vh' }}>
      <div className="sticky top-0 flex h-[100svh] items-center px-4">
        <div ref={ref} className="mx-auto w-full max-w-6xl" style={{ opacity: 0, visibility: 'hidden' }}>
          <div className="mx-auto mb-5 max-w-xl text-center">
            <p className="inline-block rounded-full bg-white/90 px-3 py-1 font-heading text-[11px] font-bold uppercase tracking-[0.25em] text-green-700 shadow">
              {t('l3d.roles.kicker')}
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-navy-900 drop-shadow-[0_2px_12px_rgba(255,255,255,0.8)] md:text-5xl">
              {t('l3d.roles.title')}
            </h2>
          </div>
          <ul className="grid gap-3 md:grid-cols-3 md:gap-5">
            {ROLES.map(({ icon: Icon, title, text, to }) => (
              <li key={title}>
                <TiltCard disabled={!to}>
                  <div className="flex items-center gap-3 md:block">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-green-300 md:h-12 md:w-12">
                      <Icon size={24} aria-hidden />
                    </span>
                    <h3 className="text-lg font-extrabold text-navy-900 md:mt-4 md:text-xl">{t(title)}</h3>
                  </div>
                  <p className="mt-2 hidden text-sm leading-relaxed text-navy-700 md:block">{t(text)}</p>
                  {to ? (
                    <Link
                      to={to}
                      className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-500 md:mt-5"
                    >
                      {t('l3d.roles.open')} <ArrowRight size={16} aria-hidden />
                    </Link>
                  ) : (
                    <span className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-gray-100 px-4 text-sm font-semibold text-navy-700 md:mt-5">
                      {t('l3d.roles.later')}
                    </span>
                  )}
                </TiltCard>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/** The real photo comes back at the very end: the 3D truck "arrives" as the real one. */
function usePhotoBookend() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const p = story.progress.finale
      const x = Math.min(1, Math.max(0, (p - 0.5) / 0.28))
      const a = x * x * (3 - 2 * x)
      if (ref.current) {
        ref.current.style.opacity = String(a)
        ref.current.style.filter = a < 0.999 ? `blur(${((1 - a) * 8).toFixed(2)}px)` : ''
        ref.current.style.visibility = a < 0.01 ? 'hidden' : 'visible'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return ref
}

export function FinaleSection() {
  const { t } = useLang()
  const ref = useSectionFade('finale', 0.45, 2)
  const photo = usePhotoBookend()
  const [asked, setAsked] = useState(false)
  return (
    <section data-story="finale" className="relative" style={{ height: '240vh' }}>
      <div className="sticky top-0 flex h-[100svh] items-start overflow-hidden px-4 pt-24 md:pt-28">
        <div ref={photo} className="absolute inset-0" style={{ opacity: 0, visibility: 'hidden', containerType: 'size' }} aria-hidden>
          <PhotoPlate animate={false} showPoints={false} />
          <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/50 to-transparent" />
        </div>
        <div ref={ref} className="relative mx-auto w-full max-w-3xl text-center" style={{ opacity: 0, visibility: 'hidden' }}>
          <p className="inline-block rounded-full bg-white/90 px-3 py-1 font-heading text-[11px] font-bold uppercase tracking-[0.3em] text-green-700 shadow">
            {t('l3d.finale.kicker')}
          </p>
          <h2 className="mt-4 text-4xl font-extrabold leading-tight text-navy-900 drop-shadow-[0_2px_16px_rgba(255,255,255,0.9)] md:text-6xl">
            {t('l3d.finale.title')}
          </h2>
          <p className="mx-auto mt-3 max-w-xl rounded-lg bg-white/80 px-3 py-1.5 text-navy-900 md:text-lg">{t('l3d.finale.body')}</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/login"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-green-700 px-8 font-heading font-semibold text-white shadow-lg shadow-green-900/25 transition hover:bg-green-500"
            >
              {t('nav.login')} <ArrowRight size={18} aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => setAsked(true)}
              className="inline-flex min-h-[52px] items-center justify-center rounded-xl border-2 border-navy-900 bg-white/90 px-8 font-heading font-semibold text-navy-900 transition hover:bg-navy-900 hover:text-white"
            >
              {t('l3d.finale.demo')}
            </button>
          </div>
          {asked && (
            <p className="mx-auto mt-3 max-w-md rounded-lg bg-white/90 px-3 py-2 text-sm text-navy-900" role="status">
              {t('l3d.finale.demoNote')}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
