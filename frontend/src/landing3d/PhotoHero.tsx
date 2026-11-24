import { forwardRef, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, Check } from 'lucide-react'
import { asset } from '../lib/asset'
import { useLang } from '../lib/i18n'

/*
 * Photo-real hero for the landing page: a highway photo (our own composite, real-brand
 * badge removed) with live "sensor" points on the truck's tyres. It imports no three.js,
 * so it paints right away while the 3D tour loads behind it; on scroll it fades away and
 * the 3D digital twin of the same truck takes over.
 *
 * The photo is drawn "cover" inside the viewport, but positioned with container units so
 * the tyre points stay locked to the tyres at any screen size and the truck stays in view
 * on narrow phones.
 */

// Photo size (px) and where things are in it.
export const PHOTO = { src: 'landing/highway-garage', w: 1273, h: 832 }
// Near-side tyres of the truck, in photo pixels.
const TYRES: [number, number][] = [
  [386, 553],
  [421, 559],
  [531, 583],
  [606, 598],
]
// Box around the truck, for the scan sweep (photo pixels).
const TRUCK_BOX = { x0: 350, y0: 345, x1: 822, y1: 642 }
// Which point of the photo we try to keep in the middle of narrow screens.
const FOCUS = { x: 0.48, y: 0.56 }

const pct = (v: number, of: number) => `${(v / of) * 100}%`

// The entrance animation (scan, points popping in, text rising) plays once per page load.
// The hero is first shown as the loading fallback and then again inside the 3D page;
// the second copy must not replay it.
// (Time-based rather than a plain flag, so React's dev double-render gives the same answer.)
let introStartedAt: number | null = null
function useIntro(animate: boolean) {
  const [intro] = useState(() => {
    if (!animate) return false
    const now = performance.now()
    if (introStartedAt === null) introStartedAt = now
    return now - introStartedAt < 400
  })
  return intro
}

/** The photo + tyre points, sized like CSS "cover" inside its (container-typed) parent. */
export function PhotoPlate({ animate = true, intro = false, showPoints = true }: { animate?: boolean; intro?: boolean; showPoints?: boolean }) {
  const { t } = useLang()
  const plate = useRef<HTMLDivElement>(null)

  // Gentle pointer parallax (desktop only; no-op on touch)
  useEffect(() => {
    if (!animate) return
    const el = plate.current
    if (!el) return
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      el.style.setProperty('--px', String((e.clientX / window.innerWidth) * 2 - 1))
      el.style.setProperty('--py', String((e.clientY / window.innerHeight) * 2 - 1))
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [animate])

  const aspect = PHOTO.w / PHOTO.h
  const style = {
    '--w': `max(100cqw, calc(100cqh * ${aspect}))`,
    '--h': `max(100cqh, calc(100cqw / ${aspect}))`,
    width: 'var(--w)',
    height: 'var(--h)',
    left: `clamp(calc(100cqw - var(--w)), calc(50cqw - ${FOCUS.x} * var(--w)), 0px)`,
    top: `clamp(calc(100cqh - var(--h)), calc(50cqh - ${FOCUS.y} * var(--h)), 0px)`,
  } as CSSProperties

  return (
    <div ref={plate} className="photo-parallax absolute" style={style}>
      <div className={`photo-plate absolute inset-0 ${animate ? 'photo-kenburns' : ''}`}>
        <picture>
          <source srcSet={asset(`${PHOTO.src}.webp`)} type="image/webp" />
          <img
            src={asset(`${PHOTO.src}.jpg`)}
            alt={t('photo.alt')}
            className="absolute inset-0 h-full w-full select-none object-cover"
            draggable={false}
            loading="eager"
            decoding="async"
          />
        </picture>

        {/* Scan sweep over the truck, once */}
        {intro && (
          <div
            className="pointer-events-none absolute overflow-hidden"
            style={{
              left: pct(TRUCK_BOX.x0, PHOTO.w),
              top: pct(TRUCK_BOX.y0, PHOTO.h),
              width: pct(TRUCK_BOX.x1 - TRUCK_BOX.x0, PHOTO.w),
              height: pct(TRUCK_BOX.y1 - TRUCK_BOX.y0, PHOTO.h),
            }}
            aria-hidden
          >
            <div className="photo-scan absolute inset-y-0 w-1/3" />
          </div>
        )}

        {/* Tyre sensor points */}
        {showPoints &&
          TYRES.map(([x, y], i) => (
            <span
              key={i}
              className={`absolute -translate-x-1/2 -translate-y-1/2 ${intro ? 'photo-point' : ''}`}
              style={{ left: pct(x, PHOTO.w), top: pct(y, PHOTO.h), animationDelay: `${1.7 + i * 0.18}s` }}
              aria-hidden
            >
              {animate && (
                <span className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-300/40 motion-safe:animate-ping" />
              )}
              <span className="relative block h-3.5 w-3.5 rounded-full bg-green-300 ring-[3px] ring-white shadow-[0_0_18px_4px_rgba(140,193,82,0.85)]" />
            </span>
          ))}

        {/* Callout next to the front tyre */}
        {showPoints && (
          <div
            className="absolute hidden -translate-y-1/2 sm:block"
            style={{ left: pct(TYRES[3][0] + 26, PHOTO.w), top: pct(TYRES[3][1] + 58, PHOTO.h) }}
          >
            <span style={{ animationDelay: '2.5s' }} className={`${intro ? 'photo-fade' : ''} inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-navy-900 shadow-lg ring-1 ring-green-500/30`}>
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-700 text-white">
                <Check size={11} strokeWidth={3} aria-hidden />
              </span>
              {t('photo.check')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The full first screen: photo, headline, buttons. `loading3d` shows a small chip while
 * the 3D tour is still loading; `animate` is off for the calm (reduced-motion) page.
 */
const PhotoHero = forwardRef<HTMLDivElement, { loading3d?: boolean; animate?: boolean; className?: string }>(
  function PhotoHero({ loading3d = false, animate = true, className = '' }, ref) {
    const { t } = useLang()
    const intro = useIntro(animate)
    return (
      <div ref={ref} className={`relative h-[100svh] w-full overflow-hidden bg-[#dfe6ec] ${className}`} style={{ containerType: 'size' }}>
        <PhotoPlate animate={animate} intro={intro} />

        {/* Soft light behind the headline so it reads on any sky */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[55%]"
          style={{ background: 'radial-gradient(ellipse 70% 75% at 50% 30%, rgba(255,255,255,0.55), rgba(255,255,255,0) 70%)' }}
          aria-hidden
        />
        {/* Darker road at the bottom, where the line and buttons sit */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-navy-900/80 via-navy-900/35 to-transparent sm:bg-gradient-to-tr sm:from-navy-900/85 sm:via-navy-900/25"
          aria-hidden
        />

        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col px-4 pb-6 pt-20 sm:pb-10 sm:pt-24 md:pt-24">
          {/* In the sky: the promise */}
          <div className={`text-center ${intro ? 'photo-rise' : ''}`}>
            <p className="inline-block rounded-full bg-white/80 px-3 py-1 font-heading text-[11px] font-bold uppercase tracking-[0.3em] text-green-700 shadow-sm backdrop-blur-sm">
              Predict · Protect · Perform
            </p>
            <h1 className="mx-auto mt-4 max-w-5xl font-heading text-[2.15rem] font-extrabold leading-[1.06] tracking-tight text-navy-900 sm:text-5xl lg:text-6xl xl:text-[4.25rem]">
              {t('photo.title')}
            </h1>
          </div>

          {/* On the road: what it does + the way in */}
          <div className={`mt-auto flex items-end justify-between gap-6 ${intro ? 'photo-rise photo-rise-2' : ''}`}>
            <div className="w-full sm:max-w-md">
              <p className="mb-5 hidden text-lg font-medium leading-snug text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] sm:block">
                {t('hero.line')}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-green-700 px-8 font-heading font-semibold text-white shadow-lg shadow-green-900/30 transition hover:bg-green-500"
                >
                  {t('nav.login')} <ArrowRight size={18} aria-hidden />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-white/90 px-8 font-heading font-semibold text-navy-900 shadow-lg ring-1 ring-navy-900/10 backdrop-blur-sm transition hover:bg-white"
                >
                  {t('hero.how')}
                </a>
              </div>
            </div>
            {(animate || loading3d) && (
              <p className="hidden shrink-0 items-center gap-2 pb-3 text-sm font-medium text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)] lg:flex">
                {loading3d ? (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-green-300" aria-hidden /> {t('photo.loading3d')}
                  </>
                ) : (
                  <>
                    <ArrowDown size={16} className="animate-bounce" aria-hidden /> {t('l3d.scroll')}
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  },
)

export default PhotoHero
