import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, Check, Cloud, Cpu, MapPin, Radio, Wrench } from 'lucide-react'
import PhotoHero, { PHOTO } from './PhotoHero'
import { FinaleSection, PillarsList, RolesSection } from './Finale'
import { Body, HotLeakPanel, JourneySteps, Kicker, LeakReadout, StorySection, Title } from './StoryCard'
import { DEMO_LEAK_PSI_PER_H, detectLowPower, ease, heatNow, hotLeakAt, leakAt, story, type SectionId } from './store'
import { useStoryScroll } from './storyScroll'
import { GARAGES, ROUTE, TOWNS } from './corridor'
import LandingPage from '../pages/LandingPage'
import LanguageSwitch from '../components/LanguageSwitch'
import Wordmark from '../components/Wordmark'
import { asset } from '../lib/asset'
import { haversineKm } from '../lib/geo'
import { useLang } from '../lib/i18n'

/*
 * Photo-real landing page. Each story chapter has its own real photo, fixed behind the page.
 * Scrolling cross-fades from one photo to the next and moves a slow "camera" over each one,
 * while live EcoStream data (sensor chips, the leak countdown, heat, the alert on the driver's
 * phone, the route to the garage) is drawn on top, locked to the right spot in the photo.
 * The story text is the same as the 3D tour (/?3d).
 */

// ---------- Chapters and their photos ----------

/** z = zoom (1 = cover), fx/fy = photo point to aim at (0..1), sx/sy = where it goes on screen (0..1). */
interface Shot {
  z: number
  fx: number
  fy: number
  sx: number
  sy: number
}
const shot = (z: number, fx: number, fy: number, sx = fx, sy = fy): Shot => ({ z, fx, fy, sx, sy })

interface Chapter {
  id: SectionId
  /** photo path without extension (a .webp and a .jpg exist) */
  src: string
  w: number
  h: number
  /** camera at the start and end of the chapter: desktop (land) and phones (port) */
  land: [Shot, Shot]
  port: [Shot, Shot]
  /** part of the chapter's scroll over which the camera moves */
  move?: [number, number]
  blur?: number
  dim?: number
}

const SIDE = { src: 'landing/truck-side', w: 1376, h: 768 }
const LEAK = { src: 'landing/tyre-leak', w: 1376, h: 768 }
const HOT = { src: 'landing/tyre-hot', w: 1376, h: 768 }
const CAB = { src: 'landing/cab-phone', w: 1376, h: 768 }
const AERIAL = { src: 'landing/corridor-aerial', w: 1376, h: 768 }
const OFFICE = { src: 'landing/owner-office', w: 1376, h: 768 }
const GARAGE = { src: 'landing/garage-check', w: 1376, h: 768 }

/**
 * Desktop keeps the subject right of the text card (left). Phones keep it above the card (bottom).
 */
const CHAPTERS: Chapter[] = [
  { id: 'hero', ...PHOTO, land: [shot(1.05, 0.48, 0.56, 0.5, 0.5), shot(1.05, 0.48, 0.56, 0.5, 0.5)], port: [shot(1.05, 0.48, 0.56, 0.5, 0.5), shot(1.05, 0.48, 0.56, 0.5, 0.5)] },
  { id: 'xray', ...SIDE, land: [shot(1, 0.62, 0.55), shot(1.07, 0.64, 0.56)], port: [shot(1.25, 0.6, 0.56, 0.5, 0.33), shot(1.25, 0.72, 0.56, 0.5, 0.33)] },
  { id: 'leak', ...LEAK, land: [shot(1, 0.47, 0.47, 0.6, 0.5), shot(1.14, 0.48, 0.5, 0.62, 0.5)], port: [shot(1.25, 0.47, 0.45, 0.5, 0.3), shot(1.38, 0.48, 0.47, 0.5, 0.3)] },
  { id: 'hotleak', ...HOT, land: [shot(1, 0.55, 0.42, 0.62, 0.5), shot(1.08, 0.55, 0.42, 0.64, 0.5)], port: [shot(1.2, 0.55, 0.42, 0.5, 0.22), shot(1.26, 0.55, 0.42, 0.5, 0.22)] },
  { id: 'journey', ...CAB, land: [shot(1, 0.7, 0.5), shot(1.1, 0.7, 0.5)], port: [shot(1.25, 0.71, 0.5, 0.5, 0.3), shot(1.4, 0.71, 0.5, 0.5, 0.3)] },
  {
    id: 'map',
    ...AERIAL,
    // start on the truck, then pan back along the road to the tyre shop
    land: [shot(1.2, 0.74, 0.6, 0.72, 0.5), shot(1.45, 0.33, 0.64, 0.7, 0.55)],
    port: [shot(1.3, 0.74, 0.6, 0.5, 0.3), shot(1.3, 0.33, 0.68, 0.5, 0.3)],
    move: [0.15, 0.8],
  },
  { id: 'pillars', ...PHOTO, land: [shot(1.1, 0.5, 0.5), shot(1.16, 0.5, 0.5)], port: [shot(1.1, 0.5, 0.5), shot(1.16, 0.5, 0.5)], blur: 14, dim: 0.08 },
  { id: 'roles', ...OFFICE, land: [shot(1, 0.5, 0.5), shot(1.06, 0.5, 0.5)], port: [shot(1, 0.35, 0.5, 0.5, 0.5), shot(1.06, 0.35, 0.5, 0.5, 0.5)], blur: 3 },
  { id: 'finale', ...GARAGE, land: [shot(1, 0.55, 0.6, 0.55, 0.62), shot(1.06, 0.58, 0.62, 0.58, 0.64)], port: [shot(1.2, 0.6, 0.62, 0.5, 0.72), shot(1.26, 0.6, 0.62, 0.5, 0.72)] },
]

/** Where each chapter's photo is on screen right now (updated every frame). */
interface View {
  tx: number
  ty: number
  s: number
}
const views: Record<string, View> = Object.fromEntries(CHAPTERS.map((c) => [c.id, { tx: 0, ty: 0, s: 1 }]))
const screen = { vw: 1, vh: 1, portrait: false }
const ChapterCtx = createContext<SectionId>('hero')
function toScreen(id: SectionId, x: number, y: number): [number, number] {
  const v = views[id]
  return [v.tx + x * v.s, v.ty + y * v.s]
}

/** Things to update every frame, after the cameras have moved. */
const frameFns = new Set<() => void>()
function useStageFrame(fn: () => void) {
  const latest = useRef(fn)
  latest.current = fn
  useEffect(() => {
    const f = () => latest.current()
    frameFns.add(f)
    return () => {
      frameFns.delete(f)
    }
  }, [])
}

/** Re-render a few times a second with a value read from the story (numbers on screen). */
function useTicker<T>(read: () => T, ms = 90): T {
  const [v, setV] = useState(read)
  const r = useRef(read)
  r.current = read
  useEffect(() => {
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      if (now - last > ms) {
        last = now
        setV(r.current())
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ms])
  return v
}

const mixShot = (a: Shot, b: Shot, t: number): Shot => ({
  z: a.z + (b.z - a.z) * t,
  fx: a.fx + (b.fx - a.fx) * t,
  fy: a.fy + (b.fy - a.fy) * t,
  sx: a.sx + (b.sx - a.sx) * t,
  sy: a.sy + (b.sy - a.sy) * t,
})
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** The fixed photo layers (one per chapter), their cameras, and the overlays. */
function PhotoStage({ over }: { over: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const layers = useRef<(HTMLDivElement | null)[]>([])
  const plates = useRef<(HTMLDivElement | null)[]>([])
  const overRef = useRef(over)
  overRef.current = over

  useEffect(() => {
    const low = detectLowPower()
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove)
    const filters: string[] = CHAPTERS.map(() => '')
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const el = root.current
      if (!el || overRef.current) return
      const vw = el.clientWidth
      const vh = el.clientHeight
      const portrait = vw / vh < 0.8
      Object.assign(screen, { vw, vh, portrait })
      pointer.sx += (pointer.x - pointer.sx) * 0.06
      pointer.sy += (pointer.y - pointer.sy) * 0.06

      // Each chapter's photo fades in over the one before; hide what is fully covered.
      const op = CHAPTERS.map((c, i) => (i === 0 ? 1 : ease(story.progress[c.id], 0, 0.1)))
      let top = 0
      for (let i = op.length - 1; i >= 0; i--) {
        if (op[i] >= 0.999) {
          top = i
          break
        }
      }
      CHAPTERS.forEach((c, i) => {
        const layer = layers.current[i]
        const plate = plates.current[i]
        if (!layer || !plate) return
        const shown = i >= top && op[i] > 0.001
        layer.style.visibility = shown ? 'visible' : 'hidden'
        layer.style.opacity = op[i].toFixed(3)
        if (!shown) return
        const [a, b] = portrait ? c.port : c.land
        const [m0, m1] = c.move ?? [0, 1]
        const k = mixShot(a, b, ease(story.progress[c.id], m0, m1))
        const s = Math.max(vw / c.w, vh / c.h) * k.z
        const tx = clamp(k.sx * vw - k.fx * c.w * s - pointer.sx * 10, vw - c.w * s, 0)
        const ty = clamp(k.sy * vh - k.fy * c.h * s - pointer.sy * 6, vh - c.h * s, 0)
        views[c.id] = { tx, ty, s }
        plate.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${s.toFixed(5)})`
        layer.style.setProperty('--ps', s.toFixed(4))
        // Blur is costly on phones: they only dim.
        const blur = low ? 0 : c.blur ?? 0
        const dim = (c.dim ?? 0) + (low && c.blur ? 0.12 : 0)
        const f = `${blur ? `blur(${(blur / s).toFixed(1)}px) ` : ''}${dim ? `brightness(${(1 - dim).toFixed(2)})` : ''}`
        if (f !== filters[i]) {
          plate.style.filter = f
          filters[i] = f
        }
      })
      frameFns.forEach((fn) => fn())
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return (
    <div ref={root} className="fixed inset-0 z-0 overflow-hidden bg-[#dfe6ec]" style={{ visibility: over ? 'hidden' : 'visible' }} aria-hidden>
      {CHAPTERS.map((c, i) => {
        const Overlay = OVERLAYS[c.id]
        return (
          <div key={c.id} ref={(el) => (layers.current[i] = el)} className="absolute inset-0 overflow-hidden" style={{ visibility: i ? 'hidden' : 'visible', opacity: i ? 0 : 1 }}>
            <div ref={(el) => (plates.current[i] = el)} className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ width: c.w, height: c.h }}>
              <picture>
                <source srcSet={asset(`${c.src}.webp`)} type="image/webp" />
                <img src={asset(`${c.src}.jpg`)} alt="" className="h-full w-full select-none" draggable={false} loading={i < 2 ? 'eager' : 'lazy'} decoding="async" />
              </picture>
            </div>
            {Overlay && (
              <ChapterCtx.Provider value={c.id}>
                <Overlay />
              </ChapterCtx.Provider>
            )}
          </div>
        )
      })}
      {/* soft top light so the header reads on any photo */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/45 to-transparent" />
    </div>
  )
}

/** A layer inside a chapter that fades with the story (vis returns 0..1). */
function Layer({ vis, children, className = '' }: { vis: () => number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useStageFrame(() => {
    const el = ref.current
    if (!el) return
    const a = vis()
    el.style.opacity = a.toFixed(3)
    el.style.visibility = a < 0.01 ? 'hidden' : 'visible'
  })
  return (
    <div ref={ref} className={`pointer-events-none absolute inset-0 ${className}`} style={{ opacity: 0, visibility: 'hidden' }}>
      {children}
    </div>
  )
}

/** Something pinned to a point of this chapter's photo (its own 0,0 is that point). */
function Anchored({ x, y, children, className = '' }: { x: number; y: number; children: ReactNode; className?: string }) {
  const id = useContext(ChapterCtx)
  const ref = useRef<HTMLDivElement>(null)
  useStageFrame(() => {
    const el = ref.current
    if (!el) return
    const [X, Y] = toScreen(id, x, y)
    el.style.transform = `translate3d(${X.toFixed(1)}px, ${Y.toFixed(1)}px, 0)`
  })
  return (
    <div ref={ref} className={`absolute left-0 top-0 ${className}`}>
      {children}
    </div>
  )
}

/** A sensor chip: label on a leader line above a glowing dot. */
function Chip({ lift, warn = false, children }: { lift: number; warn?: boolean; children: ReactNode }) {
  return (
    <>
      <span className={`absolute left-0 w-px -translate-x-1/2 ${warn ? 'bg-warning' : 'bg-green-300'}`} style={{ bottom: 0, height: lift - 10 }} />
      <span
        className={`absolute left-0 -translate-x-1/2 whitespace-nowrap rounded-lg px-2 py-1 font-heading text-[11px] font-bold shadow-lg ring-1 backdrop-blur-sm md:text-xs ${
          warn ? 'bg-warning text-navy-900 ring-navy-900/10' : 'bg-navy-900/85 text-white ring-white/15'
        }`}
        style={{ bottom: lift - 12 }}
      >
        {children}
      </span>
      <span
        className={`absolute left-0 top-0 block h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${
          warn ? 'bg-warning shadow-[0_0_16px_4px_rgba(224,161,0,0.8)]' : 'bg-green-300 shadow-[0_0_14px_4px_rgba(140,193,82,0.85)]'
        }`}
      />
    </>
  )
}

/** A green "verified garage" pin with its label. */
function GaragePin({ label, side = 'center' }: { label: string; side?: 'center' | 'right' }) {
  if (side === 'right') {
    return (
      <div className="absolute left-0 top-0 flex -translate-x-1.5 -translate-y-1/2 items-center gap-2">
        <span className="block h-3 w-3 shrink-0 rounded-full bg-green-300 ring-[3px] ring-white shadow-[0_0_16px_4px_rgba(140,193,82,0.85)]" />
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-navy-900 shadow-lg ring-1 ring-green-500/30">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-700 text-white">
            <Wrench size={10} aria-hidden />
          </span>
          {label}
        </span>
      </div>
    )
  }
  return (
    <div className="absolute bottom-2 left-0 -translate-x-1/2 text-center">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-navy-900 shadow-lg ring-1 ring-green-500/30">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-700 text-white">
          <Wrench size={10} aria-hidden />
        </span>
        {label}
      </span>
      <span className="mx-auto mt-1 block h-3 w-3 rounded-full bg-green-300 ring-[3px] ring-white shadow-[0_0_16px_4px_rgba(140,193,82,0.85)]" />
    </div>
  )
}

const P = () => story.progress

// ---------- 2. A sensor in every tyre (side view) ----------

const SIDE_TYRES = [
  { id: 'FR', x: 683, y: 529, psi: 120.2, temp: 50, lift: 70 },
  { id: 'FR-2', x: 823, y: 529, psi: 119.6, temp: 49, lift: 128 },
  { id: 'RR-O', x: 1047, y: 529, psi: 119.8, temp: 54, lift: 70 },
  { id: 'RR2-O', x: 1157, y: 529, psi: 120.4, temp: 55, lift: 128 },
]
const SIDE_BOX = { x0: 553, y0: 280, x1: 1264, y1: 573 }

function XrayOverlay() {
  const box = useRef<HTMLDivElement>(null)
  useStageFrame(() => {
    const el = box.current
    if (!el) return
    const [x0, y0] = toScreen('xray', SIDE_BOX.x0, SIDE_BOX.y0)
    const [x1, y1] = toScreen('xray', SIDE_BOX.x1, SIDE_BOX.y1)
    el.style.transform = `translate3d(${x0.toFixed(1)}px, ${y0.toFixed(1)}px, 0)`
    el.style.width = `${(x1 - x0).toFixed(1)}px`
    el.style.height = `${(y1 - y0).toFixed(1)}px`
  })
  return (
    <>
      <Layer vis={() => ease(P().xray, 0.08, 0.2)}>
        <div ref={box} className="absolute left-0 top-0 overflow-hidden rounded-xl">
          <div className="ps-scan absolute inset-y-0 w-1/3" />
          {['left-0 top-0 border-l-2 border-t-2', 'right-0 top-0 border-r-2 border-t-2', 'left-0 bottom-0 border-b-2 border-l-2', 'right-0 bottom-0 border-b-2 border-r-2'].map((c) => (
            <span key={c} className={`absolute h-6 w-6 border-green-300 ${c}`} />
          ))}
        </div>
      </Layer>
      <Layer vis={() => ease(P().xray, 0.12, 0.28)}>
        {SIDE_TYRES.map((ty) => (
          <Anchored key={ty.id} x={ty.x} y={ty.y}>
            <Chip lift={ty.lift}>
              <span className="text-green-300">{ty.id}</span> <span className="tabular-nums">{ty.psi.toFixed(1)} psi</span>
              <span className="opacity-70"> · </span>
              <span className="tabular-nums">{ty.temp} °C</span>
            </Chip>
          </Anchored>
        ))}
      </Layer>
    </>
  )
}

// ---------- 3. Slow leak (close-up of the soft tyre) ----------

function LeakOverlay() {
  const v = useTicker(() => leakAt(P().leak))
  return (
    <Layer vis={() => ease(P().leak, 0.1, 0.24)}>
      {/* amber ring around the tyre (an ellipse: we see it at an angle) */}
      <Anchored x={650} y={350}>
        <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2" style={{ width: 'calc(var(--ps) * 330px)', height: 'calc(var(--ps) * 536px)' }}>
          <span className="absolute inset-0 rounded-[50%] border-[3px] border-warning shadow-[0_0_28px_6px_rgba(224,161,0,0.45)]" />
          <span className="absolute inset-0 rounded-[50%] border-2 border-warning/60 motion-safe:animate-pulse" />
        </div>
      </Anchored>
      <Anchored x={690} y={360}>
        <Chip lift={150} warn>
          RL-O <span className="tabular-nums">{v.psi.toFixed(1)} psi</span>
          <span className="opacity-70"> · </span>
          <span className="tabular-nums">54 °C</span>
        </Chip>
      </Anchored>
      <Anchored x={693} y={578}>
        <span className="absolute left-4 top-0 -translate-y-1/2 whitespace-nowrap rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-navy-900 shadow-lg">
          −{DEMO_LEAK_PSI_PER_H} psi / hour
        </span>
      </Anchored>
    </Layer>
  )
}

// ---------- 4. Hot is not a leak (tyre on a hot road) ----------

function HotOverlay() {
  const { t } = useLang()
  const warm = useRef<HTMLDivElement>(null)
  const halo = useRef<HTMLDivElement>(null)
  useStageFrame(() => {
    const h = heatNow()
    if (warm.current) warm.current.style.opacity = (0.15 + h * 0.85).toFixed(3)
    if (halo.current) halo.current.style.opacity = (h * 0.9).toFixed(3)
  })
  const v = useTicker(() => hotLeakAt(heatNow()).hot)
  return (
    <Layer vis={() => ease(P().hotleak, 0.06, 0.18)}>
      <div
        ref={warm}
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(255,110,20,0.5), rgba(255,150,40,0.2) 45%, rgba(255,190,80,0) 70%)', mixBlendMode: 'soft-light' }}
      />
      <div ref={halo} className="absolute inset-0" style={{ mixBlendMode: 'screen' }}>
        <Anchored x={756} y={330}>
          <span
            className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 'calc(var(--ps) * 760px)',
              height: 'calc(var(--ps) * 760px)',
              background: 'radial-gradient(circle, rgba(255,80,0,0) 28%, rgba(255,90,0,0.55) 48%, rgba(255,150,0,0.25) 62%, rgba(255,150,0,0) 72%)',
            }}
          />
        </Anchored>
      </div>
      <Anchored x={756} y={320}>
        <div className="absolute bottom-[110px] left-0 -translate-x-1/2 whitespace-nowrap rounded-xl bg-navy-900/85 px-3 py-2 text-white shadow-xl ring-1 ring-white/15 backdrop-blur-sm portrait:bottom-auto portrait:top-[90px]">
          <p className="font-heading text-[11px] font-bold uppercase tracking-widest text-orange-300">{t('ps.hot.chip')}</p>
          <p className="mt-0.5 font-heading text-xl font-extrabold tabular-nums">{Math.round(v.temp)} °C</p>
          <p className="text-xs tabular-nums text-white/80">
            {t('ps.hot.gauge')} {v.gauge.toFixed(1)} · {t('ps.hot.corrected')} <span className="font-bold text-green-300">{v.corrected.toFixed(1)}</span> psi
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-green-300">
            <Check size={12} aria-hidden /> {t('ps.hot.ok')}
          </p>
        </div>
      </Anchored>
    </Layer>
  )
}

// ---------- 5. Sensor → cloud → the driver's phone ----------

const CAB_SCREEN = { x: 973, y: 388, w: 128, h: 254, rot: 4.5 }
const CAB_NODES = {
  sensor: { x: 1290, y: 700 },
  unit: { x: 1190, y: 560 },
  cloud: { x: 560, y: 70 },
  phone: { x: 985, y: 262 },
}

function JourneyOverlay() {
  const { t } = useLang()
  const svg = useRef<SVGSVGElement>(null)
  const segs = useRef<(SVGPathElement | null)[]>([])
  const dots = useRef<(SVGCircleElement | null)[]>([])
  const reached = () => ease(P().journey, 0.08, 0.8) * 4
  const step = useTicker(reached, 80)
  useStageFrame(() => {
    if (!svg.current) return
    svg.current.setAttribute('viewBox', `0 0 ${screen.vw} ${screen.vh}`)
    const n = [CAB_NODES.sensor, CAB_NODES.unit, CAB_NODES.cloud, CAB_NODES.phone].map((p) => toScreen('journey', p.x, p.y))
    const d = [
      `M${n[0][0]},${n[0][1]} Q${n[0][0] - 10},${n[1][1] + 20} ${n[1][0]},${n[1][1]}`,
      `M${n[1][0]},${n[1][1]} Q${n[1][0] - 120},${n[2][1] - 40} ${n[2][0]},${n[2][1]}`,
      `M${n[2][0]},${n[2][1]} Q${(n[2][0] + n[3][0]) / 2},${n[2][1] - 30} ${n[3][0]},${n[3][1]}`,
    ]
    const r = reached()
    d.forEach((path, i) => {
      const el = segs.current[i]
      if (!el) return
      el.setAttribute('d', path)
      el.style.strokeDashoffset = String(1 - clamp(r - i, 0, 1))
    })
    n.forEach((pt, i) => {
      const el = dots.current[i]
      if (!el) return
      el.setAttribute('cx', pt[0].toFixed(1))
      el.setAttribute('cy', pt[1].toFixed(1))
      el.style.opacity = r >= i - 0.05 ? '1' : '0'
    })
  })
  const lp = leakAt(1)
  const h = Math.floor(lp.hoursLeft)
  const m = Math.round((lp.hoursLeft - h) * 60)
  const alert = step >= 3.3
  return (
    <Layer vis={() => ease(P().journey, 0.05, 0.15)}>
      <svg ref={svg} className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <filter id="ps-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[0, 1, 2].map((i) => (
          <path key={i} ref={(el) => (segs.current[i] = el)} pathLength={1} fill="none" stroke="#A9E070" strokeWidth={3} strokeLinecap="round" strokeDasharray="1 1" filter="url(#ps-glow)" />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} ref={(el) => (dots.current[i] = el)} r={6} fill="#A9E070" stroke="#fff" strokeWidth={2} className="transition-opacity duration-300" />
        ))}
      </svg>
      <Anchored x={CAB_NODES.sensor.x} y={CAB_NODES.sensor.y}>
        <span className="absolute bottom-3 right-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-navy-900/85 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm">
          <Radio size={13} className="text-green-300" aria-hidden /> {t('l3d.journey.s0')}
        </span>
      </Anchored>
      <Anchored x={CAB_NODES.unit.x} y={CAB_NODES.unit.y}>
        <span className={`absolute bottom-3 right-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-navy-900/85 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm transition-opacity duration-300 ${step > 0.9 ? 'opacity-100' : 'opacity-0'}`}>
          <Cpu size={13} className="text-green-300" aria-hidden /> {t('ps.unit')}
        </span>
      </Anchored>
      <Anchored x={CAB_NODES.cloud.x} y={CAB_NODES.cloud.y}>
        <div className={`absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 text-center transition-opacity duration-500 ${step > 1.9 ? 'opacity-100' : 'opacity-40'}`}>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 text-green-700 shadow-xl ring-1 ring-green-500/30 backdrop-blur">
            <Cloud size={26} aria-hidden />
          </span>
          <span className="mt-1 block whitespace-nowrap rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-navy-900 shadow">{t('ps.cloud')} · 4G</span>
        </div>
      </Anchored>
      {/* The live app on the phone in the mount */}
      <Anchored x={CAB_SCREEN.x} y={CAB_SCREEN.y}>
        <div
          className="absolute left-0 top-0 overflow-hidden rounded-[10px] bg-[#0b1220]"
          style={{
            width: CAB_SCREEN.w,
            height: CAB_SCREEN.h,
            transform: `translate(-50%, -50%) scale(var(--ps)) rotate(${CAB_SCREEN.rot}deg)`,
            boxShadow: alert ? '0 0 30px 6px rgba(224,161,0,0.35)' : '0 0 24px 4px rgba(140,193,82,0.25)',
          }}
        >
          <div className="flex h-full flex-col px-2 pb-2 pt-3 text-white">
            <p className="flex items-center gap-1 text-[8px] font-bold text-white/80">
              <img src={asset('logo-mark.png')} alt="" className="h-3 w-3" /> EcoStream
              <span className="ml-auto text-white/50">9:41</span>
            </p>
            {alert ? (
              <div className="mt-2 rounded-lg bg-warning p-1.5 text-navy-900">
                <p className="flex items-center gap-1 text-[7px] font-bold uppercase tracking-wider">
                  <BellRing size={8} aria-hidden /> {t('ps.alert.kicker')}
                </p>
                <p className="mt-0.5 text-[10px] font-extrabold leading-tight">{t('ps.alert.title')}</p>
                <p className="mt-0.5 text-[8px] leading-snug">{t('ps.alert.body', { h, m: String(m).padStart(2, '0') })}</p>
              </div>
            ) : (
              <div className="mt-2 rounded-lg bg-white/10 p-1.5">
                <p className="text-[7px] font-bold uppercase tracking-wider text-green-300">{t('ps.phone.live')}</p>
                <p className="mt-0.5 text-[10px] font-extrabold leading-tight">{t('ps.phone.ok')}</p>
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-1">
              {['FL', 'FR', 'RL-O', 'RL-I', 'RR-I', 'RR-O'].map((id) => (
                <span
                  key={id}
                  className={`rounded px-1 py-0.5 text-[7px] font-bold ${alert && id === 'RL-O' ? 'bg-warning text-navy-900' : 'bg-white/10 text-white/85'}`}
                >
                  {id} {alert && id === 'RL-O' ? lp.psi.toFixed(0) : '120'}
                </span>
              ))}
            </div>
            {alert && (
              <p className="mt-auto inline-flex items-center justify-center gap-1 rounded-md bg-green-700 px-1 py-1 text-[8px] font-semibold">
                <MapPin size={8} aria-hidden /> {t('ps.alert.cta')}
              </p>
            )}
          </div>
        </div>
      </Anchored>
    </Layer>
  )
}

// ---------- 6. Corridor (aerial) ----------

const AERIAL_TRUCK = { x: 1027, y: 445 }
const AERIAL_SHOP = { x: 427, y: 465 }

function MapOverlay() {
  const { t } = useLang()
  const svg = useRef<SVGSVGElement>(null)
  const path = useRef<SVGPathElement>(null)
  useStageFrame(() => {
    if (!svg.current || !path.current) return
    svg.current.setAttribute('viewBox', `0 0 ${screen.vw} ${screen.vh}`)
    const a = toScreen('map', 1000, 500)
    const c = toScreen('map', 780, 720)
    const b = toScreen('map', 480, 560)
    path.current.setAttribute('d', `M${a[0]},${a[1]} Q${c[0]},${c[1]} ${b[0]},${b[1]}`)
    path.current.style.strokeDashoffset = String(1 - ease(P().map, 0.3, 0.75))
  })
  return (
    <>
      <Layer vis={() => ease(P().map, 0.08, 0.2)}>
        <svg ref={svg} className="absolute inset-0 h-full w-full">
          <path ref={path} pathLength={1} strokeDasharray="1 1" fill="none" stroke="#A9E070" strokeWidth={5} strokeLinecap="round" filter="url(#ps-glow-map)" />
          <defs>
            <filter id="ps-glow-map" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>
        <Anchored x={AERIAL_TRUCK.x} y={AERIAL_TRUCK.y}>
          <Chip lift={70} warn>
            RL-O · {t('ps.map.truck')}
          </Chip>
        </Anchored>
      </Layer>
      <Layer vis={() => ease(P().map, 0.55, 0.7)}>
        <Anchored x={AERIAL_SHOP.x + 20} y={AERIAL_SHOP.y}>
          <GaragePin label={t('ps.garage')} side="right" />
        </Anchored>
      </Layer>
      <Layer vis={() => ease(P().map, 0.1, 0.25)} className="hidden md:block">
        <CorridorCard className="right-6 top-24 w-[300px]" />
      </Layer>
    </>
  )
}
// ---------- Corridor map ----------

const LON_MIN = 77.8
const LON_MAX = 80.5
const LAT_MIN = 11.0
const LAT_MAX = 13.3
const KX = Math.cos((12.15 * Math.PI) / 180)
const MW = 1000
const MH = Math.round((MW * (LAT_MAX - LAT_MIN)) / ((LON_MAX - LON_MIN) * KX))
const mx = (lon: number) => ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * MW
const my = (lat: number) => ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MH
const unLon = (x: number) => LON_MIN + (x / MW) * (LON_MAX - LON_MIN)
const unLat = (y: number) => LAT_MAX - (y / MH) * (LAT_MAX - LAT_MIN)
const ROUTE_D = ROUTE.map(([la, lo], i) => `${i ? 'L' : 'M'}${mx(lo).toFixed(1)},${my(la).toFixed(1)}`).join(' ')
const MAP_TRUCKS = [0.08, 0.27, 0.5, 0.71, 0.9]
const AMBER = 2
const AMBER_AT = 0.43
const HILLS: [number, number, number][] = [
  [11.8, 78.22, 70],
  [11.3, 78.36, 60],
  [12.65, 78.6, 55],
  [12.2, 78.75, 50],
]

function CorridorCard({ className = '' }: { className?: string }) {
  const { t } = useLang()
  const route = useRef<SVGPathElement>(null)
  const trucks = useRef<(SVGGElement | null)[]>([])
  const detour = useRef<SVGPathElement>(null)
  const label = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState<{ x: number; y: number; gx: number; gy: number; km: number } | null>(null)

  useEffect(() => {
    const el = route.current
    if (!el) return
    const L = el.getTotalLength()
    const pt = el.getPointAtLength(AMBER_AT * L)
    const lat = unLat(pt.y)
    const lon = unLon(pt.x)
    let best = { i: 0, km: Infinity }
    GARAGES.forEach(([gl, go], i) => {
      const km = haversineKm(lat, lon, gl, go)
      if (km < best.km && km > 1) best = { i, km }
    })
    const [gl, go] = GARAGES[best.i]
    setNear({ x: pt.x, y: pt.y, gx: mx(go), gy: my(gl), km: best.km })
  }, [])

  useStageFrame(() => {
    const p = story.progress.map
    const el = route.current
    if (!el) return
    el.style.strokeDashoffset = String(1 - ease(p, 0.05, 0.32))
    const L = el.getTotalLength()
    const move = ease(p, 0.2, 0.6)
    const time = performance.now() / 1000
    MAP_TRUCKS.forEach((start, i) => {
      const g = trucks.current[i]
      if (!g) return
      const u = i === AMBER ? start + (AMBER_AT - start) * move : (start + move * 0.12 + time * 0.004) % 1
      const pt = el.getPointAtLength(Math.min(0.999, Math.max(0, u)) * L)
      g.setAttribute('transform', `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})`)
      g.style.opacity = String(ease(p, 0.15, 0.25))
    })
    if (detour.current) detour.current.style.strokeDashoffset = String(1 - ease(p, 0.58, 0.82))
    if (label.current) label.current.style.opacity = String(ease(p, 0.78, 0.88))
  })

  const amberOn = () => ease(story.progress.map, 0.5, 0.58)
  const amberRef = useRef<SVGCircleElement>(null)
  useStageFrame(() => {
    if (amberRef.current) amberRef.current.style.opacity = String(amberOn())
  })

  return (
    <div className={`pointer-events-none absolute ${className}`}>
      <div className="relative overflow-hidden rounded-2xl bg-white/85 p-1.5 shadow-2xl ring-1 ring-navy-900/10 backdrop-blur-md">
        <svg viewBox={`0 0 ${MW} ${MH}`} className="block h-auto w-full">
          <defs>
            <pattern id="ps-grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M50 0H0V50" fill="none" stroke="#0B1E36" strokeOpacity="0.06" strokeWidth="1.5" />
            </pattern>
            <radialGradient id="ps-hill">
              <stop offset="0%" stopColor="#7c94a8" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#7c94a8" stopOpacity="0" />
            </radialGradient>
            <filter id="ps-route-glow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width={MW} height={MH} fill="#f3f6f4" />
          <rect width={MW} height={MH} fill="url(#ps-grid)" />
          {/* Bay of Bengal */}
          <path d={`M${mx(80.32)},0 L${MW},0 L${MW},${MH} L${mx(80.05)},${MH} Q${mx(80.2)},${my(12.2)} ${mx(80.32)},0 Z`} fill="#bcd3e4" />
          <text x={mx(80.38)} y={my(11.6)} fontSize="22" fill="#3d6a8c" fontStyle="italic" textAnchor="middle" transform={`rotate(-80 ${mx(80.38)} ${my(11.6)})`}>
            Bay of Bengal
          </text>
          {HILLS.map(([la, lo, r]) => (
            <circle key={`${la}-${lo}`} cx={mx(lo)} cy={my(la)} r={r} fill="url(#ps-hill)" />
          ))}
          {/* Highway */}
          <path d={ROUTE_D} fill="none" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
          <path
            ref={route}
            d={ROUTE_D}
            pathLength={1}
            strokeDasharray="1 1"
            fill="none"
            stroke="#13304F"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Garages */}
          {GARAGES.map(([la, lo], i) => (
            <g key={i} transform={`translate(${mx(lo)},${my(la)})`}>
              <circle r={near && Math.abs(mx(lo) - near.gx) < 0.1 && Math.abs(my(la) - near.gy) < 0.1 ? 13 : 8} fill="#5C9A35" stroke="#fff" strokeWidth="3" />
            </g>
          ))}
          {/* Towns */}
          {TOWNS.map((tw) => {
            const left = tw.name === 'Chennai'
            return (
              <g key={tw.name} transform={`translate(${mx(tw.lon)},${my(tw.lat)})`}>
                <circle r={tw.big ? 7 : 5} fill="#0B1E36" />
                <text
                  x={left ? -16 : 16}
                  y={-12}
                  textAnchor={left ? 'end' : 'start'}
                  fontSize={tw.big ? 30 : 25}
                  fontWeight={700}
                  fill="#0B1E36"
                  stroke="#f3f6f4"
                  strokeWidth="6"
                  paintOrder="stroke"
                >
                  {tw.name}
                </text>
              </g>
            )
          })}
          {/* Route to the nearest garage */}
          {near && (
            <path
              ref={detour}
              d={`M${near.x},${near.y} Q${(near.x + near.gx) / 2 + 40},${(near.y + near.gy) / 2 - 40} ${near.gx},${near.gy}`}
              pathLength={1}
              strokeDasharray="1 1"
              fill="none"
              stroke="#5C9A35"
              strokeWidth="7"
              strokeLinecap="round"
              filter="url(#ps-route-glow)"
            />
          )}
          {/* Trucks */}
          {MAP_TRUCKS.map((_, i) => (
            <g key={i} ref={(el) => (trucks.current[i] = el)} style={{ opacity: 0 }}>
              {i === AMBER && <circle ref={amberRef} r={26} fill="#E0A100" fillOpacity={0.25} className="motion-safe:animate-pulse" />}
              <rect x={-13} y={-8} width={26} height={16} rx={4} fill={i === AMBER ? '#E0A100' : '#ffffff'} stroke="#0B1E36" strokeWidth={3} />
            </g>
          ))}
        </svg>
        {near && (
          <div ref={label} className="absolute bottom-2 right-2 rounded-lg bg-navy-900/90 px-2 py-1 text-white shadow-lg" style={{ opacity: 0 }}>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-green-300">
              <Wrench size={12} aria-hidden /> {t('ps.nearest')}
            </p>
            <p className="font-heading text-sm font-extrabold tabular-nums">{near.km.toFixed(1)} km</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- 9. Finale: tyre checked at a verified garage ----------

function FinaleOverlay() {
  const { t } = useLang()
  return (
    <Layer vis={() => ease(P().finale, 0.18, 0.36)}>
      <Anchored x={807} y={529}>
        <Chip lift={96}>
          <span className="text-green-300">FL</span> <span className="tabular-nums">120.1 psi</span>
          <span className="opacity-70"> · </span>
          {t('ps.finale.ok')}
        </Chip>
      </Anchored>
      <Anchored x={293} y={150}>
        <GaragePin label={t('ps.garage')} />
      </Anchored>
    </Layer>
  )
}

/** A light wash so the navy headline reads over the office photo. */
function RolesOverlay() {
  return <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/55 via-white/30 to-white/10" />
}

const OVERLAYS: Partial<Record<SectionId, () => JSX.Element>> = {
  roles: RolesOverlay,
  xray: XrayOverlay,
  leak: LeakOverlay,
  hotleak: HotOverlay,
  journey: JourneyOverlay,
  map: MapOverlay,
  finale: FinaleOverlay,
}

// ---------- Page ----------

export default function PhotoStory() {
  const { t } = useLang()
  const [over, setOver] = useState(false)
  const storyEnd = useRef<HTMLDivElement>(null)
  const hero = useRef<HTMLDivElement>(null)
  const onOver = useCallback((v: boolean) => setOver(v), [])
  useStoryScroll(storyEnd, onOver)

  // The hero's headline and buttons fade as you scroll (the stage behind shows the same photo).
  useStageFrame(() => {
    const el = hero.current
    if (!el) return
    const a = 1 - ease(story.progress.hero, 0.25, 0.7)
    el.style.opacity = a.toFixed(3)
    el.style.visibility = a < 0.01 ? 'hidden' : 'visible'
  })

  return (
    <div className="relative bg-[#eef2f5]">
      <PhotoStage over={over} />

      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 rounded-xl bg-white/85 px-2 py-1 shadow-sm" aria-label="EcoStream home">
            <img src={asset('logo-mark.png')} alt="" className="h-9 w-9 object-contain" />
            <Wordmark className="text-base" />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitch className="hidden sm:inline-flex" />
            <Link
              to="/login"
              className="inline-flex min-h-[44px] items-center rounded-lg bg-green-700 px-5 text-sm font-semibold text-white shadow-lg shadow-green-900/20 transition hover:bg-green-500"
            >
              {t('nav.login')}
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section data-story="hero" className="relative h-[200vh]">
          <div className="sticky top-0 h-[100svh] overflow-hidden">
            <PhotoHero ref={hero} />
          </div>
        </section>

        <StorySection id="xray">
          <Kicker>{t('l3d.xray.kicker')}</Kicker>
          <Title>{t('l3d.xray.title')}</Title>
          <Body>{t('l3d.xray.body')}</Body>
          <p className="mt-3 text-xs text-navy-700">{t('l3d.demo')}</p>
        </StorySection>

        <StorySection id="leak" height="260vh">
          <Kicker>{t('l3d.leak.kicker')}</Kicker>
          <Title>{t('l3d.leak.title')}</Title>
          <Body>{t('l3d.leak.body')}</Body>
          <LeakReadout />
        </StorySection>

        <StorySection id="hotleak" height="280vh">
          <Kicker>{t('l3d.hot.kicker')}</Kicker>
          <Title>{t('l3d.hot.title')}</Title>
          <div className="hidden md:block">
            <Body>{t('l3d.hot.body')}</Body>
          </div>
          <HotLeakPanel />
        </StorySection>

        <StorySection id="journey" height="260vh">
          <Kicker>{t('l3d.journey.kicker')}</Kicker>
          <Title>{t('l3d.journey.title')}</Title>
          <div className="hidden md:block">
            <Body>{t('l3d.journey.body')}</Body>
          </div>
          <JourneySteps />
        </StorySection>

        <StorySection id="map" height="260vh">
          <Kicker>{t('l3d.map.kicker')}</Kicker>
          <Title>{t('l3d.map.title')}</Title>
          <div className="hidden md:block">
            <Body>{t('l3d.map.body')}</Body>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-navy-900">
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-white ring-1 ring-navy-900/30" aria-hidden /> {t('l3d.map.trucks')}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-warning" aria-hidden /> {t('l3d.map.attention')}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-green-500" aria-hidden /> {t('l3d.map.garages')}
            </li>
          </ul>
          <p className="mt-2 text-xs text-navy-700">{t('l3d.map.note')}</p>
        </StorySection>

        <StorySection id="pillars" height="220vh">
          <Kicker>{t('l3d.pillars.kicker')}</Kicker>
          <Title>{t('l3d.pillars.title')}</Title>
          <PillarsList />
        </StorySection>

        <RolesSection />
        <FinaleSection bookend={false} />

        <div ref={storyEnd} className="relative bg-green-50">
          <LandingPage embedded />
        </div>
      </main>
    </div>
  )
}
