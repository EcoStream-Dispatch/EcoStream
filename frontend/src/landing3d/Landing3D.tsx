import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight } from 'lucide-react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useProgress } from '@react-three/drei'
import Experience from './Experience'
import Loader from './Loader'
import { FinaleSection, PillarsList, RolesSection } from './Finale'
import { Body, HotLeakPanel, JourneySteps, Kicker, LeakReadout, StorySection, Title } from './StoryCard'
import { SECTIONS, detectLowPower, story, type SectionId } from './store'
import LandingPage from '../pages/LandingPage'
import LanguageSwitch from '../components/LanguageSwitch'
import Wordmark from '../components/Wordmark'
import { asset } from '../lib/asset'
import { useLang } from '../lib/i18n'

gsap.registerPlugin(ScrollTrigger)

/*
 * 3D landing page. A fixed WebGL canvas sits behind the page; HTML story sections scroll
 * over it, and each section's scroll progress (0..1) drives the 3D scene (store.ts).
 * After the story, the regular landing sections (pillars, how it works, footer) follow
 * on a solid background. Text is always HTML, so it stays sharp and accessible.
 *
 * Phase 1: hero. Later phases add sections: xray, leak, hotleak, journey, map, finale.
 */
export default function Landing3D() {
  const { t } = useLang()
  const { progress } = useProgress()
  const [startAt, setStartAt] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  const storyEnd = useRef<HTMLDivElement>(null)
  const heroText = useRef<HTMLDivElement>(null)

  // Decide once whether this device gets the lighter version
  useState(() => {
    story.lowPower = detectLowPower()
    return null
  })

  const onReady = useCallback((t: number) => setStartAt(t), [])
  const ready = startAt !== null

  // Smooth scrolling + scroll progress for each story section
  useEffect(() => {
    const lenis = new Lenis({ autoRaf: false, lerp: 0.1 })
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    const triggers: ScrollTrigger[] = []
    document.querySelectorAll<HTMLElement>('[data-story]').forEach((el) => {
      const id = el.dataset.story as SectionId
      if (!SECTIONS.includes(id)) return
      triggers.push(
        ScrollTrigger.create({
          trigger: el,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => {
            story.progress[id] = self.progress
          },
        }),
      )
    })
    // Pause the 3D once the story has fully scrolled away
    if (storyEnd.current) {
      triggers.push(
        ScrollTrigger.create({
          trigger: storyEnd.current,
          start: 'top top',
          onToggle: (self) => {
            story.visible = !self.isActive
            setPaused(self.isActive)
          },
        }),
      )
    }
    // Hero text fades and lifts away as you start scrolling
    if (heroText.current) {
      triggers.push(
        ScrollTrigger.create({
          trigger: '[data-story="hero"]',
          start: 'top top',
          end: '35% top',
          scrub: true,
          animation: gsap.fromTo(heroText.current, { opacity: 1, y: 0 }, { opacity: 0, y: -40, ease: 'none' }),
        }),
      )
    }
    return () => {
      triggers.forEach((tr) => tr.kill())
      gsap.ticker.remove(tick)
      lenis.destroy()
      story.visible = true
      SECTIONS.forEach((s) => (story.progress[s] = 0))
    }
  }, [])

  // Pointer / tilt parallax
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      story.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      story.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      story.pointer.x = Math.max(-1, Math.min(1, e.gamma / 30))
      story.pointer.y = Math.max(-1, Math.min(1, (45 - e.beta) / 30))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('deviceorientation', onTilt)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('deviceorientation', onTilt)
    }
  }, [])

  return (
    <div className="relative bg-[#f2c792]">
      {/* ---------- Fixed 3D canvas ---------- */}
      <div className="fixed inset-0 z-0" aria-hidden>
        <Experience startAt={startAt} onReady={onReady} paused={paused} />
      </div>

      <Loader done={ready} progress={progress} />

      {/* ---------- Header over the scene ---------- */}
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
        {/* ---------- 1. Hero ---------- */}
        <section data-story="hero" className="relative h-[230vh]">
          <div className="sticky top-0 flex h-[100svh] flex-col justify-end">
            <div
              ref={heroText}
              className={`bg-gradient-to-t from-navy-900/80 via-navy-900/45 to-transparent px-4 pb-10 pt-24 transition-all duration-1000 md:pb-14 ${
                ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
              }`}
              style={{ transitionDelay: ready ? '1.6s' : '0s' }}
            >
              <div className="mx-auto max-w-6xl text-white">
                <h1 className="sr-only">EcoStream</h1>
                <p className="font-heading text-xs font-bold uppercase tracking-[0.35em] text-green-300 md:text-sm">
                  Predict · Protect · Perform
                </p>
                <p className="mt-3 max-w-2xl text-xl font-semibold leading-snug md:text-3xl">{t('hero.line')}</p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/login"
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-green-700 px-8 font-heading font-semibold text-white shadow-lg shadow-green-900/30 transition hover:bg-green-500"
                  >
                    {t('nav.login')} <ArrowRight size={18} aria-hidden />
                  </Link>
                  <a
                    href="#how-it-works"
                    className="inline-flex min-h-[52px] items-center justify-center rounded-xl border-2 border-white/70 px-8 font-heading font-semibold text-white transition hover:bg-white hover:text-navy-900"
                  >
                    {t('hero.how')}
                  </a>
                </div>
                <p className="mt-6 hidden items-center gap-2 text-sm text-white/75 md:flex">
                  <ArrowDown size={16} className="animate-bounce" aria-hidden /> {t('l3d.scroll')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 2. X-ray ---------- */}
        <StorySection id="xray">
          <Kicker>{t('l3d.xray.kicker')}</Kicker>
          <Title>{t('l3d.xray.title')}</Title>
          <Body>{t('l3d.xray.body')}</Body>
          <p className="mt-3 text-xs text-navy-700">{t('l3d.demo')}</p>
        </StorySection>

        {/* ---------- 3. Slow leak ---------- */}
        <StorySection id="leak" height="260vh">
          <Kicker>{t('l3d.leak.kicker')}</Kicker>
          <Title>{t('l3d.leak.title')}</Title>
          <Body>{t('l3d.leak.body')}</Body>
          <LeakReadout />
        </StorySection>

        {/* ---------- 4. Hot is not a leak ---------- */}
        <StorySection id="hotleak" height="280vh">
          <Kicker>{t('l3d.hot.kicker')}</Kicker>
          <Title>{t('l3d.hot.title')}</Title>
          <div className="hidden md:block">
            <Body>{t('l3d.hot.body')}</Body>
          </div>
          <HotLeakPanel />
        </StorySection>

        {/* ---------- 5. Signal journey ---------- */}
        <StorySection id="journey" height="260vh">
          <Kicker>{t('l3d.journey.kicker')}</Kicker>
          <Title>{t('l3d.journey.title')}</Title>
          <div className="hidden md:block">
            <Body>{t('l3d.journey.body')}</Body>
          </div>
          <JourneySteps />
        </StorySection>

        {/* ---------- 6. Corridor map ---------- */}
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

        {/* ---------- 7. Five pillars ---------- */}
        <StorySection id="pillars" height="220vh">
          <Kicker>{t('l3d.pillars.kicker')}</Kicker>
          <Title>{t('l3d.pillars.title')}</Title>
          <PillarsList />
        </StorySection>

        {/* ---------- 8. Who it's for ---------- */}
        <RolesSection />

        {/* ---------- 9. Sunrise finale ---------- */}
        <FinaleSection />

        {/* ---------- After the story: regular sections on a solid background ---------- */}
        <div ref={storyEnd} className="relative bg-green-50">
          <LandingPage embedded />
        </div>
      </main>
    </div>
  )
}
