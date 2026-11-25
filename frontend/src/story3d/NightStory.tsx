import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowRight, Box, Gauge, Menu, Pause, Play, Sparkles, X } from 'lucide-react'
import { useProgress } from '@react-three/drei'
import Scene from './Scene'
import { quality } from './state'
import { detectLowPower, heatNow, hotLeakAt, journeyStep, leakAt, story, type SectionId } from '../landing3d/store'
import LandingPage from '../pages/LandingPage'
import { asset } from '../lib/asset'
import { useLang } from '../lib/i18n'
import { useManifest } from '../models3d/useManifest'
import { useModelMeta } from '../models3d/ModelViewer'

const ModelViewer = lazy(() => import('../models3d/ModelViewer'))

gsap.registerPlugin(ScrollTrigger)

/*
 * EcoStream night story: one long scroll through a night-time highway lay-by.
 * A fixed WebGL scene (Scene.tsx) sits behind the page; each chapter's scroll progress drives
 * the camera and the scene. Text stays HTML (sharp, translatable, accessible).
 * Chapter rail on the left, glass caption cards, Auto tour, Explore 3D (orbit / inspect /
 * explode the Blender models), parts showcase, and a quality switch.
 */

const CHAPTERS: { id: SectionId; label: string; height: string }[] = [
  { id: 'hero', label: 'The night shift', height: '200vh' },
  { id: 'xray', label: 'A sensor in every tyre', height: '220vh' },
  { id: 'leak', label: 'Slow leak, caught early', height: '240vh' },
  { id: 'hotleak', label: 'Hot is not a leak', height: '260vh' },
  { id: 'journey', label: 'Tyre to phone', height: '260vh' },
  { id: 'map', label: 'One corridor map', height: '220vh' },
  { id: 'finale', label: 'Into the garage', height: '240vh' },
]
const USED = CHAPTERS.map((c) => c.id)

function useStory(onOver: (over: boolean) => void) {
  const lenis = useRef<Lenis | null>(null)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const l = new Lenis({ autoRaf: false, lerp: 0.09 })
    lenis.current = l
    l.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => l.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    const trs: ScrollTrigger[] = []
    document.querySelectorAll<HTMLElement>('[data-story]').forEach((el) => {
      const id = el.dataset.story as SectionId
      if (!USED.includes(id)) return
      trs.push(ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom bottom', onUpdate: (s) => (story.progress[id] = s.progress) }))
    })
    if (end.current) trs.push(ScrollTrigger.create({ trigger: end.current, start: 'top top', onToggle: (s) => onOver(s.isActive) }))
    return () => {
      trs.forEach((t) => t.kill())
      gsap.ticker.remove(tick)
      l.destroy()
      Object.keys(story.progress).forEach((k) => (story.progress[k as SectionId] = 0))
    }
  }, [onOver])
  return { lenis, end }
}

/** Which chapter is on screen (for the rail and the menu). */
function useActiveChapter() {
  const [active, setActive] = useState(0)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      let a = 0
      CHAPTERS.forEach((c, i) => {
        if (story.progress[c.id] > 0.02) a = i
      })
      setActive((prev) => (prev === a ? prev : a))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return active
}

/** A chapter: tall scroll section with a sticky glass caption card that fades in and out. */
function Chapter({ id, index, height, children, align = 'left' }: { id: SectionId; index: number; height: string; children: ReactNode; align?: 'left' | 'right' }) {
  const card = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const p = story.progress[id]
      const a = Math.min(1, Math.max(0, (p - 0.06) / 0.14)) * (1 - Math.min(1, Math.max(0, (p - 0.86) / 0.12)))
      if (card.current) {
        card.current.style.opacity = String(a)
        card.current.style.transform = `translateY(${(1 - a) * 18}px)`
        card.current.style.visibility = a < 0.01 ? 'hidden' : 'visible'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [id])
  return (
    <section data-story={id} id={`ch-${id}`} className="relative" style={{ height }}>
      <div className="sticky top-0 flex h-[100svh] items-end px-3 pb-3 md:px-0 md:pb-10">
        <div
          ref={card}
          className={`w-full md:ml-[150px] md:w-[440px] ${align === 'right' ? 'md:ml-auto md:mr-10' : ''}`}
          style={{ opacity: 0, visibility: 'hidden' }}
        >
          <div className="rounded-2xl border border-white/10 bg-[#0b1117]/70 p-4 text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl md:p-6">
            <p className="font-mono text-[11px] tracking-[0.22em] text-white/55">
              <span className="text-[#5fe39a]">{String(index + 1).padStart(2, '0')}</span>&nbsp;&nbsp;CHAPTER
            </p>
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}

const H = ({ children }: { children: ReactNode }) => <h2 className="mt-1.5 font-heading text-xl font-extrabold uppercase leading-tight tracking-wide md:text-2xl">{children}</h2>
const P = ({ children }: { children: ReactNode }) => <p className="mt-2 text-sm leading-relaxed text-white/75">{children}</p>
const K = ({ children }: { children: ReactNode }) => <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#5fe39a]">{children}</p>

/** Live numbers read from the scene state every frame (no React re-render per frame). */
function useTicker<T>(read: () => T, ms = 120) {
  const [v, setV] = useState(read)
  useEffect(() => {
    const t = setInterval(() => setV(read()), ms)
    return () => clearInterval(t)
  }, [read, ms])
  return v
}

function LeakNumbers() {
  const v = useTicker(useCallback(() => leakAt(Math.min(1, story.progress.leak * 1.15)), []))
  const h = Math.floor(v.hoursLeft)
  const m = Math.round((v.hoursLeft - h) * 60)
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 font-mono">
      <div className="col-span-3 rounded-xl border border-amber-300/40 bg-amber-400/15 p-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200/80">Unsafe in</p>
        <p className="text-3xl font-bold text-amber-300">
          {h} h {String(m).padStart(2, '0')} min
        </p>
      </div>
      <Stat label="Corrected" value={`${v.psi.toFixed(1)} psi`} />
      <Stat label="Falling" value="3 psi/h" />
      <Stat label="Fast-forward" value={`+${v.minutesShown} min`} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
      <p className="text-[9px] uppercase tracking-[0.18em] text-white/50">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function HotNumbers() {
  const v = useTicker(useCallback(() => hotLeakAt(heatNow()), []))
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
      {(['hot', 'leak'] as const).map((k) => {
        const t = v[k]
        const alarm = k === 'leak' && v.alert
        return (
          <div key={k} className={`rounded-xl border p-2.5 ${alarm ? 'border-amber-300/50 bg-amber-400/10' : 'border-white/10 bg-white/5'}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">{k === 'hot' ? 'Hot tyre' : 'Leaking tyre'}</p>
            <p className="mt-1 flex justify-between text-white/60"><span>Gauge</span><span className="text-white">{t.gauge.toFixed(1)}</span></p>
            <p className="flex justify-between text-white/60"><span>Corrected</span><span className={alarm ? 'text-amber-300' : 'text-[#5fe39a]'}>{t.corrected.toFixed(1)}</span></p>
            <p className={`mt-1.5 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold ${alarm ? 'bg-amber-400 text-black' : 'bg-white/10 text-[#9ff0c2]'}`}>
              {alarm ? 'Slow-leak alert' : k === 'hot' ? 'Just heat' : 'Watching…'}
            </p>
          </div>
        )
      })}
      <p className="col-span-2 text-[10px] text-white/45">{v.hot.temp.toFixed(0)} °C after {v.minutes} min of driving · psi · demo values</p>
    </div>
  )
}

const STEPS = ['Tyre sensor (sealed)', 'EcoStream unit in the cab', '4G mobile network', 'EcoStream cloud checks it', "Alert on the owner's phone"]
function JourneyNumbers() {
  const s = useTicker(useCallback(() => journeyStep(story.progress.journey), []))
  return (
    <div className="mt-3 flex gap-3">
      <ol className="flex-1 space-y-1.5 text-sm">
        {STEPS.map((x, i) => (
          <li key={x} className={`flex items-center gap-2 transition ${i <= s ? 'text-white' : 'text-white/35'}`}>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] ${i <= s ? 'bg-[#5fe39a] text-black' : 'border border-white/20'}`}>{i + 1}</span>
            {x}
          </li>
        ))}
      </ol>
      {/* the alert as it lands on the owner's phone */}
      <div className={`hidden w-[124px] shrink-0 rounded-[18px] border border-white/20 bg-black p-1.5 transition duration-500 sm:block ${s >= 4 ? 'opacity-100' : 'translate-y-2 opacity-30'}`}>
        <div className="rounded-[13px] bg-[#0f1a14] p-2">
          <p className="text-[8px] font-bold uppercase tracking-wider text-[#5fe39a]">EcoStream</p>
          <p className="mt-1 text-[10px] font-semibold leading-tight text-white">TN 01 · Rear-left outer tyre losing air</p>
          <p className="mt-1 text-[9px] leading-tight text-white/60">Unsafe in about 4 h. Nearest open garage: 6 km.</p>
          <p className="mt-1.5 rounded bg-[#5fe39a] py-0.5 text-center text-[9px] font-bold text-black">Show the way</p>
        </div>
      </div>
    </div>
  )
}

/* ---------- Explore 3D / parts showcase ---------- */
function Explore({ open, onClose, showcase }: { open: boolean; onClose: () => void; showcase: boolean }) {
  const { manifest } = useManifest()
  const [id, setId] = useState('truck')
  const model = open ? manifest?.models.find((m) => m.id === id) : undefined
  const meta = useModelMeta(model)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#05080c]/95 backdrop-blur" role="dialog" aria-modal="true" aria-label="Explore the 3D models">
      <div className="flex items-center justify-between gap-2 px-4 py-3 text-white">
        <div className="flex gap-2">
          {manifest?.models.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setId(m.id)}
              className={`min-h-[40px] rounded-full px-4 text-sm font-semibold ${id === m.id ? 'bg-white text-black' : 'border border-white/20 text-white/80 hover:bg-white/10'}`}
            >
              {m.title}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/20 px-4 text-sm font-semibold hover:bg-white/10">
          <X size={16} aria-hidden /> Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {model && meta && (
          <Suspense fallback={null}>
            <ModelViewer key={`${model.id}-${showcase}`} model={model} meta={meta} height="h-[62vh] md:h-[70vh]" autoShowcase={showcase} />
          </Suspense>
        )}
      </div>
    </div>
  )
}

function Loader({ ready }: { ready: boolean }) {
  const { progress } = useProgress()
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#04070b] transition-opacity duration-700 ${ready ? 'opacity-0' : 'opacity-100'}`}
      aria-hidden={ready}
    >
      <p className="font-mono text-[11px] tracking-[0.3em] text-white/50">LOADING THE NIGHT SHIFT</p>
      <div className="mt-3 h-px w-56 overflow-hidden bg-white/10">
        <div className="h-full bg-[#5fe39a] transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 font-mono text-[11px] text-white/40">{Math.round(progress)}%</p>
    </div>
  )
}

export default function NightStory() {
  const { t } = useLang()
  const [mode, setMode] = useState<'auto' | 'high' | 'low'>('auto')
  const low = mode === 'low' || (mode === 'auto' && detectLowPower())
  quality.low = low
  quality.mode = mode
  const [ready, setReady] = useState(false)
  const [over, setOver] = useState(false)
  const [touring, setTouring] = useState(false)
  const [explore, setExplore] = useState<null | 'explore' | 'showcase'>(null)
  const [menu, setMenu] = useState(false)
  const onOver = useCallback((o: boolean) => setOver(o), [])
  const { lenis, end } = useStory(onOver)
  const active = useActiveChapter()
  const { manifest } = useManifest()
  const truckFile = manifest?.models.find((m) => m.id === 'truck')
  const wheelFile = manifest?.models.find((m) => m.id === 'wheel')

  const goTo = useCallback(
    (i: number, duration = 2.2) => {
      const el = document.getElementById(`ch-${CHAPTERS[i].id}`)
      if (!el || !lenis.current) return
      const y = el.offsetTop + (i === 0 ? 0 : el.offsetHeight * 0.5 - window.innerHeight * 0.5)
      lenis.current.scrollTo(y, { duration, easing: (x: number) => 1 - Math.pow(1 - x, 3) })
    },
    [lenis],
  )

  // Auto tour: glide through every chapter, pausing on each; any wheel / touch / key stops it.
  useEffect(() => {
    if (!touring || !lenis.current) return
    let cancelled = false
    const stop = () => setTouring(false)
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('touchstart', stop, { passive: true })
    window.addEventListener('keydown', stop)
    ;(async () => {
      for (let i = Math.max(1, active); i < CHAPTERS.length && !cancelled; i++) {
        const el = document.getElementById(`ch-${CHAPTERS[i].id}`)!
        const from = el.offsetTop
        const to = el.offsetTop + el.offsetHeight - window.innerHeight
        await new Promise<void>((r) => lenis.current!.scrollTo(from + 2, { duration: 2.4, onComplete: () => r() }))
        if (cancelled) break
        await new Promise<void>((r) => lenis.current!.scrollTo(to - 4, { duration: 9, easing: (x: number) => x, onComplete: () => r() }))
      }
      if (!cancelled) setTouring(false)
    })()
    return () => {
      cancelled = true
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('keydown', stop)
    }
  }, [touring]) // eslint-disable-line react-hooks/exhaustive-deps

  // pointer parallax
  useEffect(() => {
    const mv = (e: PointerEvent) => {
      story.pointer.x = (e.clientX / innerWidth) * 2 - 1
      story.pointer.y = -((e.clientY / innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', mv)
    return () => window.removeEventListener('pointermove', mv)
  }, [])

  return (
    <div className="relative bg-[#04070b] text-white">
      <div className="fixed inset-0 z-0" aria-hidden>
        {truckFile && wheelFile && (
          <Scene
            key={mode}
            paused={over}
            onReady={() => setReady(true)}
            truckUrl={low ? truckFile.files.low.url : truckFile.files.high.url}
            wheelUrl={low ? wheelFile.files.low.url : wheelFile.files.high.url}
          />
        )}
      </div>
      <Loader ready={ready} />

      {/* ---------- top bar ---------- */}
      <header className="fixed inset-x-0 top-0 z-30">
        <div className="flex items-center justify-between gap-2 px-3 py-3 md:px-6">
          <Link to="/" className="flex items-center gap-2" aria-label="EcoStream home">
            <img src={asset('logo-mark.png')} alt="" className="h-9 w-9 rounded-lg bg-white/90 object-contain p-0.5" />
            <span className="hidden font-mono text-[11px] leading-tight tracking-[0.2em] text-white/90 sm:block">
              ECOSTREAM
              <br />
              <span className="text-white/50">THE NIGHT SHIFT</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-white/75 lg:flex">
            <button type="button" onClick={() => setExplore('explore')} className="hover:text-white">Explore 3D</button>
            <button type="button" onClick={() => setExplore('showcase')} className="flex items-center gap-1 hover:text-white">
              <Sparkles size={14} aria-hidden /> Parts showcase
            </button>
            <Link to="/models" className="hover:text-white">Models</Link>
          </nav>
          <div className="flex items-center gap-2">
            <label className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 text-xs text-white/80 backdrop-blur sm:flex">
              <Gauge size={14} aria-hidden />
              <span className="sr-only">Quality</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="min-h-[36px] bg-transparent text-xs outline-none">
                <option value="auto" className="text-black">Auto</option>
                <option value="high" className="text-black">High</option>
                <option value="low" className="text-black">Low</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setTouring((v) => !v)}
              className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-black shadow-lg hover:bg-white/90"
            >
              {touring ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />} {touring ? 'Stop tour' : 'Auto tour'}
            </button>
            <Link to="/login" className="hidden min-h-[40px] items-center rounded-full border border-white/20 px-4 text-sm font-semibold hover:bg-white/10 md:flex">
              {t('nav.login')}
            </Link>
            <button type="button" onClick={() => setMenu(true)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 md:hidden" aria-label="Chapters and options">
              <Menu size={18} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      {/* ---------- chapter rail ---------- */}
      <nav className={`fixed left-6 top-1/2 z-20 hidden -translate-y-1/2 md:block ${over || active === 0 ? 'pointer-events-none opacity-0' : 'opacity-100'} transition duration-500`} aria-label="Chapters">
        <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-white/15">
          {CHAPTERS.map((c, i) => (
            <li key={c.id}>
              <button type="button" onClick={() => goTo(i)} className="group relative flex items-center gap-3" aria-current={active === i ? 'step' : undefined}>
                <span
                  className={`flex h-[27px] w-[27px] items-center justify-center rounded-full border font-mono text-[10px] transition ${
                    active === i ? 'border-[#5fe39a] bg-[#5fe39a] text-black shadow-[0_0_18px_rgba(95,227,154,0.7)]' : 'border-white/25 bg-black/50 text-white/60 group-hover:border-white/60'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={`whitespace-nowrap text-xs transition ${active === i ? 'text-white' : 'text-white/0 group-hover:text-white/70'}`}>{c.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {/* ---------- phone menu ---------- */}
      {menu && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setMenu(false)}>
          <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-[#0b1117] p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-mono text-[11px] tracking-[0.2em] text-white/50">CHAPTERS</p>
            <ol className="mt-2 space-y-1">
              {CHAPTERS.map((c, i) => (
                <li key={c.id}>
                  <button type="button" onClick={() => { setMenu(false); goTo(i) }} className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 text-left text-sm ${active === i ? 'bg-white/10 text-white' : 'text-white/70'}`}>
                    <span className="font-mono text-[11px] text-[#5fe39a]">{String(i + 1).padStart(2, '0')}</span> {c.label}
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setMenu(false); setExplore('explore') }} className="min-h-[44px] rounded-lg border border-white/15 text-sm">Explore 3D</button>
              <button type="button" onClick={() => { setMenu(false); setExplore('showcase') }} className="min-h-[44px] rounded-lg border border-white/15 text-sm">Parts showcase</button>
              <label className="col-span-2 flex min-h-[44px] items-center justify-between rounded-lg border border-white/15 px-3 text-sm">
                Quality
                <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="bg-transparent">
                  <option value="auto" className="text-black">Auto</option>
                  <option value="high" className="text-black">High</option>
                  <option value="low" className="text-black">Low</option>
                </select>
              </label>
              <Link to="/login" className="col-span-2 flex min-h-[44px] items-center justify-center rounded-lg bg-[#5fe39a] text-sm font-semibold text-black">{t('nav.login')}</Link>
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10">
        {/* ---------- 1. hero ---------- */}
        <section data-story="hero" id="ch-hero" className="relative" style={{ height: CHAPTERS[0].height }}>
          <div className="sticky top-0 flex h-[100svh] flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent px-5 pb-8 md:justify-center md:bg-none md:px-[150px] md:pb-0">
            <HeroCopy onTour={() => setTouring(true)} onScroll={() => goTo(1)} onExplore={() => setExplore('explore')} onShowcase={() => setExplore('showcase')} />
          </div>
        </section>

        <Chapter id="xray" index={1} height={CHAPTERS[1].height}>
          <H>{t('l3d.xray.title')}</H>
          <P>{t('l3d.xray.body')}</P>
          <K>10 tyres · 10 sealed sensors · every ~10 s · demo values</K>
        </Chapter>
        <Chapter id="leak" index={2} height={CHAPTERS[2].height}>
          <H>{t('l3d.leak.title')}</H>
          <P>{t('l3d.leak.body')}</P>
          <LeakNumbers />
        </Chapter>
        <Chapter id="hotleak" index={3} height={CHAPTERS[3].height}>
          <H>{t('l3d.hot.title')}</H>
          <P>{t('l3d.hot.body')}</P>
          <HotNumbers />
        </Chapter>
        <Chapter id="journey" index={4} height={CHAPTERS[4].height}>
          <H>{t('l3d.journey.title')}</H>
          <P>{t('l3d.journey.body')}</P>
          <JourneyNumbers />
        </Chapter>
        <Chapter id="map" index={5} height={CHAPTERS[5].height}>
          <H>{t('l3d.map.title')}</H>
          <P>{t('l3d.map.body')}</P>
          <K>Chennai · Vellore · Krishnagiri · Salem · Namakkal</K>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-white/70">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#5fe39a]" /> Verified garages (demo)</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-400" /> A truck on the corridor</span>
          </div>
        </Chapter>
        <Chapter id="finale" index={6} height={CHAPTERS[6].height}>
          <H>{t('l3d.finale.title')}</H>
          <P>EcoStream found the nearest verified garage that is open now, and the driver pulled in with hours to spare.</P>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/login" className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#5fe39a] px-5 text-sm font-semibold text-black hover:bg-[#7ef0b1]">
              {t('nav.login')} <ArrowRight size={16} aria-hidden />
            </Link>
            <button type="button" onClick={() => setExplore('explore')} className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/20 px-5 text-sm font-semibold hover:bg-white/10">
              <Box size={16} aria-hidden /> Explore the truck in 3D
            </button>
          </div>
        </Chapter>

        <div ref={end} className="relative bg-green-50 text-navy-900">
          <LandingPage embedded />
        </div>
      </main>

      <Explore open={!!explore} showcase={explore === 'showcase'} onClose={() => setExplore(null)} />
    </div>
  )
}

function HeroCopy({ onTour, onScroll, onExplore, onShowcase }: { onTour: () => void; onScroll: () => void; onExplore: () => void; onShowcase: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const p = story.progress.hero
      const a = 1 - Math.min(1, Math.max(0, (p - 0.35) / 0.3))
      if (ref.current) {
        ref.current.style.opacity = String(a)
        ref.current.style.transform = `translateY(${-(1 - a) * 30}px)`
        ref.current.style.visibility = a < 0.01 ? 'hidden' : 'visible'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const btn = 'flex min-h-[44px] w-full items-center justify-between gap-6 border-b border-white/10 py-2 text-left font-mono text-xs tracking-[0.2em] text-white/80 hover:text-white sm:w-72'
  return (
    <div ref={ref} className="max-w-xl md:pt-10">
      <p className="font-mono text-[11px] tracking-[0.3em] text-white/55">A 3D JOURNEY · SCROLL TO BEGIN</p>
      <h1 className="mt-3 font-heading text-[44px] font-extrabold md:mt-4 md:text-7xl uppercase leading-[0.95] tracking-tight">
        Every tyre.
        <br />
        <span className="text-[#5fe39a]">Watched.</span>
      </h1>
      <p className="mt-3 font-mono text-xs tracking-[0.25em] text-white/60">FROM A SLOW LEAK TO A SAFE GARAGE</p>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70 md:mt-5 md:text-base">
        A 10-wheel tipper stops in a highway lay-by at night. Inside each tyre, a sealed EcoStream sensor is already counting the hours.
      </p>
      <div className="mt-4 flex flex-col md:mt-6">
        <button type="button" onClick={onTour} className={btn}>▶ AUTO TOUR <ArrowRight size={14} aria-hidden /></button>
        <button type="button" onClick={onScroll} className={btn}>SCROLL AT MY OWN PACE <ArrowRight size={14} aria-hidden /></button>
        <button type="button" onClick={onShowcase} className={btn}>★ PARTS SHOWCASE <ArrowRight size={14} aria-hidden /></button>
        <button type="button" onClick={onExplore} className={btn}>EXPLORE 3D <ArrowRight size={14} aria-hidden /></button>
      </div>
    </div>
  )
}
