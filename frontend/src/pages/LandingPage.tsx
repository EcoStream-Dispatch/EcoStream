import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  BellRing,
  Cloud,
  Cpu,
  Fuel,
  MapPin,
  Package,
  Radio,
  ShieldCheck,
  Signal,
  Truck,
  UserRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import Wordmark from '../components/Wordmark'
import LanguageSwitch from '../components/LanguageSwitch'
import { asset } from '../lib/asset'
import { useLang } from '../lib/i18n'
import StaticStory from '../landing3d/StaticStory'

/*
 * Public landing page - layout from the Stitch screen "EcoStream Fleet Landing Page"
 * (light navy + green). Copy is our own.
 * Rule (docs/BRAND.md): no fake customer logos, testimonials or made-up numbers here.
 */

// The five pillars from our logo.
export const PILLARS: { icon: LucideIcon; title: string; text: string; tag: string }[] = [
  { icon: MapPin, title: 'Real-Time Tracking', text: 'See where each truck is and how its tyres are doing, live.', tag: 'GPS + 4G' },
  { icon: Fuel, title: 'Fuel Efficiency', text: 'Correct tyre pressure means less rolling resistance and less diesel burnt.', tag: 'Right pressure' },
  { icon: Wrench, title: 'Predictive Maintenance', text: 'Spot a slow leak or a hot tyre early, before it becomes a breakdown.', tag: 'Temperature-corrected' },
  { icon: ShieldCheck, title: 'Safety Assurance', text: 'Fewer blowouts on the highway, for drivers and everyone around them.', tag: 'Alerts in time' },
  { icon: BarChart3, title: 'Smart Insights', text: 'Pressure and temperature history for every tyre, in one place.', tag: 'Every tyre' },
]

// "How it works": the path a reading takes, from the tyre to a garage.
const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Radio, title: 'Sensor', text: 'A sensor in each tyre measures pressure and temperature.' },
  { icon: Cloud, title: 'Cloud', text: 'Readings go to the cloud, corrected for temperature.' },
  { icon: BellRing, title: 'Alert', text: 'The owner is alerted to a slow leak, low pressure or overheating.' },
  { icon: Wrench, title: 'Garage', text: 'We show the nearest verified garages that are open now.' },
]

const PORTALS: { icon: LucideIcon; badge: string; title: string; sub: string; text: string; to?: string; cta: string }[] = [
  {
    icon: Truck,
    badge: 'Owner',
    title: 'Truck owner',
    sub: 'Fleet health at a glance',
    text: 'Every truck and tyre in one list, alerts in plain words, and the nearest open garage in one tap.',
    to: '/login',
    cta: 'Open owner portal',
  },
  {
    icon: UserRound,
    badge: 'Driver',
    title: 'Driver',
    sub: 'One glance, one tap',
    text: 'A simple cockpit: tyre status, the next garage on the route and what to do now. Readable in bright sun.',
    to: '/login',
    cta: 'Open driver view',
  },
  {
    icon: Package,
    badge: 'Later',
    title: 'Shipper',
    sub: 'Track your goods',
    text: 'Shipment tracking for the people who hire the truck. Planned for a later phase.',
    cta: 'Coming later',
  },
]

const HARDWARE: { label: string; value: string }[] = [
  { label: 'Processor', value: 'ESP32-S3' },
  { label: 'Tyre sensors', value: '433 MHz TPMS' },
  { label: 'Connectivity', value: '4G + GPS' },
  { label: 'Engine data', value: 'CAN / J1939 (later)' },
]

/**
 * `embedded`: used under the 3D landing page (src/landing3d), which draws its own
 * header and hero, so only the sections below the hero are shown.
 */
export default function LandingPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useLang()
  return (
    <div className="flex min-h-screen flex-col bg-green-50">
      {!embedded && <Header />}

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        {!embedded && (
        <section className="mx-auto flex max-w-6xl flex-col items-center px-4 pb-14 pt-8 text-center md:pt-14">
          <div className="mb-6 flex w-full justify-end">
            <LanguageSwitch />
          </div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 shadow-sm ring-1 ring-green-500/30">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" aria-hidden />
            <span className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-navy-900">
              Predict <span className="text-green-500">·</span> Protect <span className="text-green-500">·</span> Perform
            </span>
          </div>
          <h1 className="text-5xl sm:text-6xl">
            <Wordmark />
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-navy-700 sm:text-xl">{t('hero.line')}</p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              to="/login"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-green-700 px-8 font-heading font-semibold text-white shadow-lg shadow-green-700/25 transition hover:bg-green-500"
            >
              {t('nav.login')} <ArrowRight size={18} aria-hidden />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border-2 border-navy-900/15 bg-white px-8 font-heading font-semibold text-navy-900 transition hover:border-green-700 hover:text-green-700"
            >
              {t('hero.how')}
            </a>
          </div>

          {/* Pillars strip */}
          <ul className="mt-10 grid w-full max-w-4xl grid-cols-2 gap-3 border-t border-navy-900/10 pt-6 sm:grid-cols-3 md:grid-cols-5">
            {PILLARS.map(({ icon: Icon, title }, i) => (
              <li
                key={title}
                className={`flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 ring-1 ring-green-500/15 ${
                  i === PILLARS.length - 1 ? 'col-span-2 sm:col-span-1' : ''
                }`}
              >
                <Icon size={18} className="shrink-0 text-green-500" aria-hidden />
                <span className="font-heading text-xs font-bold text-navy-900">{title}</span>
              </li>
            ))}
          </ul>

          {/* Hero visual: the logo on a card, with the live-gateway chip from the design */}
          <div className="relative mt-12 flex w-full max-w-5xl items-center justify-center overflow-hidden rounded-2xl bg-white py-12 shadow-2xl ring-1 ring-green-500/15 sm:py-16">
            <img
              src={asset('logo.png')}
              alt="EcoStream logo: a connected truck inside a green leaf-shaped E, with the five pillars"
              className="w-64 sm:w-96"
            />
            <div className="absolute left-4 top-4 flex items-center gap-3 rounded-xl bg-navy-900 px-3.5 py-2.5 text-left text-white shadow-lg sm:left-6 sm:top-6">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-300" aria-hidden />
              <span>
                <span className="block font-heading text-[10px] font-bold uppercase tracking-wider text-green-300">On-truck gateway</span>
                <span className="block text-xs font-semibold text-white/90">ESP32-S3 · TPMS · GPS</span>
              </span>
            </div>
          </div>
        </section>
        )}

        {/* Reduced motion / no WebGL: the 3D page's story, as plain sections */}
        {!embedded && <StaticStory />}

        {/* ---------- Five pillars ---------- */}
        {!embedded && (
        <section className="border-y border-green-500/15 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-green-500">What EcoStream does</p>
              <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">Built around the 5 EcoStream pillars</h2>
              <p className="mt-3 text-navy-700">Starting with tyres: the part that fails most often, and quietly burns diesel when it's low.</p>
            </div>
            <ul className="grid gap-5 md:grid-cols-3">
              {PILLARS.map(({ icon: Icon, title, text, tag }, i) => (
                <li
                  key={title}
                  className={`flex flex-col justify-between rounded-2xl bg-white p-6 shadow-sm ring-1 ring-green-500/15 transition hover:-translate-y-0.5 hover:ring-green-500 md:p-8 ${
                    i === 3 ? 'md:col-span-2' : ''
                  }`}
                >
                  <div>
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-700 ring-1 ring-green-500/15">
                      <Icon size={24} strokeWidth={1.75} aria-hidden />
                    </div>
                    <h3 className="text-xl font-bold">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-navy-700">{text}</p>
                  </div>
                  <p className="mt-6 border-t border-green-500/15 pt-4 font-heading text-xs font-bold uppercase text-green-700">{tag}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
        )}

        {/* ---------- How it works ---------- */}
        <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
          <h2 className="text-center text-3xl font-extrabold">How it works</h2>
          <ol className="mt-10 flex flex-col items-stretch gap-2 md:flex-row md:items-start">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex flex-col items-center md:flex-1 md:flex-row md:items-start">
                <div className="flex w-full flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-navy-900 text-white">
                    <Icon size={28} strokeWidth={1.75} aria-hidden />
                  </div>
                  <h3 className="mt-3 font-bold">
                    <span className="text-green-700">{i + 1}.</span> {title}
                  </h3>
                  <p className="mt-1 max-w-xs text-sm text-navy-700">{text}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <>
                    <ArrowDown className="my-3 text-green-500 md:hidden" aria-hidden />
                    <ArrowRight className="mt-5 hidden shrink-0 text-green-500 md:block" aria-hidden />
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Portals ---------- */}
        {!embedded && (
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-green-500">One app, made for each role</p>
              <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">Who EcoStream is for</h2>
            </div>
            <ul className="grid gap-6 md:grid-cols-3">
              {PORTALS.map(({ icon: Icon, badge, title, sub, text, to, cta }) => (
                <li key={title} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-green-500/15">
                  <div className="relative flex h-32 items-center justify-center border-b border-green-500/15 bg-green-50">
                    <Icon size={48} strokeWidth={1.5} className="text-green-700" aria-hidden />
                    <span className="absolute left-3 top-3 rounded bg-navy-900 px-2.5 py-1 font-heading text-[10px] font-bold uppercase text-white">
                      {badge}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-lg font-bold">{title}</h3>
                    <p className="mb-3 font-heading text-xs font-semibold text-green-700">{sub}</p>
                    <p className="mb-6 flex-1 text-sm text-navy-700">{text}</p>
                    {to ? (
                      <Link
                        to={to}
                        className="flex min-h-[44px] items-center justify-center rounded-lg border-2 border-green-700 font-heading text-sm font-bold text-green-700 transition hover:bg-green-700 hover:text-white"
                      >
                        {cta}
                      </Link>
                    ) : (
                      <span className="flex min-h-[44px] items-center justify-center rounded-lg border-2 border-gray-200 font-heading text-sm font-bold text-gray-500">
                        {cta}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
        )}

        {/* ---------- Hardware ---------- */}
        <section className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-4 py-16 md:flex-row md:py-20">
          <div className="w-full md:w-1/2">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-green-500">On the truck</p>
            <h2 className="mt-1 text-3xl font-extrabold md:text-4xl">A small box that listens to every tyre</h2>
            <p className="mt-4 leading-relaxed text-navy-700">
              Off-the-shelf tyre sensors talk to our gateway over 433 MHz radio. The gateway sends readings to the cloud over 4G
              and warns the driver with a buzzer, even where there's no signal.
            </p>
            <ul className="mt-8 grid grid-cols-2 gap-3">
              {HARDWARE.map(({ label, value }) => (
                <li key={label} className="rounded-xl bg-white p-4 ring-1 ring-green-500/15">
                  <p className="font-heading text-[10px] font-bold uppercase tracking-wider text-green-700">{label}</p>
                  <p className="mt-1 font-heading text-sm font-bold sm:text-base">{value}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex w-full justify-center md:w-1/2">
            <div className="relative flex aspect-square w-full max-w-sm flex-col items-center justify-center rounded-3xl bg-white p-8 ring-2 ring-green-500/15">
              <div className="absolute h-48 w-48 animate-[spin_30s_linear_infinite] rounded-full border border-dashed border-green-500/40" aria-hidden />
              <div className="relative z-10 flex h-32 w-32 flex-col items-center justify-center rounded-2xl bg-white p-4 text-center shadow-xl ring-1 ring-green-500/15">
                <Cpu size={40} className="text-green-700" aria-hidden />
                <span className="mt-1 font-heading text-[10px] font-extrabold uppercase tracking-wider">Gateway</span>
              </div>
              <span className="relative z-10 mt-8 inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 font-heading text-xs font-bold ring-1 ring-green-500/15">
                <Signal size={14} className="text-green-700" aria-hidden /> Works offline too
              </span>
            </div>
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        {!embedded && (
        <section className="bg-navy-900 px-4 py-16 text-center text-white md:py-20">
          <div className="mx-auto max-w-3xl">
            <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-green-300">Prototype</p>
            <h2 className="mt-3 text-3xl font-extrabold text-white md:text-5xl">See your trucks' tyres, live</h2>
            <p className="mx-auto mt-5 max-w-2xl text-white/80">
              Our first pilot is planned on the Chennai - Salem - Namakkal corridor.
            </p>
            <Link
              to="/login"
              className="mt-8 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-green-300 px-8 font-heading font-bold text-navy-900 transition hover:bg-white"
            >
              {t('nav.login')} <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </section>
        )}
      </main>

      <Footer />
    </div>
  )
}
