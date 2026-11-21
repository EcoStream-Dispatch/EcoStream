import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  BellRing,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Cloud,
  Fuel,
  MapPin,
  Radio,
  ShieldCheck,
  Truck,
  UserRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import PublicLayout from '../components/PublicLayout'
import Wordmark from '../components/Wordmark'
import { primaryButton, secondaryButton } from '../components/Form'
import { asset } from '../lib/asset'
import { useLanguage } from '../i18n/LanguageProvider'

/*
 * Public Home page (docs/WEBSITE_SPEC.md, public page 1).
 * Rule: no fake customer logos, testimonials, certifications or made-up numbers here.
 */

// The five pillars from our logo.
const PILLARS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: MapPin, title: 'Real-Time Tracking', text: 'See where each truck is and how its tyres are doing, live.' },
  { icon: Fuel, title: 'Fuel Efficiency', text: 'Correct tyre pressure means less rolling resistance and less diesel burnt.' },
  { icon: Wrench, title: 'Predictive Maintenance', text: 'Spot a slow leak or a hot tyre early, before it becomes a breakdown.' },
  { icon: ShieldCheck, title: 'Safety Assurance', text: 'Fewer blowouts on the highway, for drivers and everyone around them.' },
  { icon: BarChart3, title: 'Smart Insights', text: 'Pressure, temperature and engine history for every truck, in one place.' },
]

// "How it works": the path a reading takes, from the tyre to a garage.
const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Radio, title: 'Sensor', text: 'A sensor in each tyre measures pressure and temperature.' },
  { icon: Cloud, title: 'Cloud', text: 'Readings go to the cloud, corrected for temperature.' },
  { icon: BellRing, title: 'Alert', text: 'The owner is alerted to a slow leak, low pressure or overheating.' },
  { icon: Wrench, title: 'Garage', text: 'We show the nearest verified garages that are open now.' },
]

// One block per type of user.
const AUDIENCES: { icon: LucideIcon; title: string; points: string[] }[] = [
  {
    icon: Truck,
    title: 'For truck owners',
    points: [
      'Every truck’s health, shipment and risk on one screen',
      '“Unsafe in ~3 h” warnings, not just raw numbers',
      'Book the nearest open verified garage in a tap',
      'Plan and assign shipments to healthy trucks',
    ],
  },
  {
    icon: UserRound,
    title: 'For drivers',
    points: [
      'Big, simple alerts in Tamil and English, with voice',
      'One-tap SOS that sends your location to the owner',
      'Trip details and route on a basic Android phone',
    ],
  },
  {
    icon: Building2,
    title: 'For shippers',
    points: [
      'See where your goods are and when they will arrive',
      'Know the truck carrying them is in good condition',
      'Delivery proof and invoices in one place',
    ],
  },
]

export default function LandingPage() {
  const { t } = useLanguage()
  return (
    <PublicLayout>
      {/* ---------- Hero ---------- */}
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:py-20">
        <div className="text-center md:text-left">
          <h1 className="text-4xl sm:text-5xl">
            <Wordmark />
          </h1>
          <p className="mt-3 font-heading text-sm font-semibold tracking-[0.2em] text-green-700 sm:text-base">
            {t('common.tagline')}
          </p>
          <p className="mt-6 text-lg leading-relaxed text-navy-700 sm:text-xl">
            Know a tyre or engine problem before it stops your truck - and reach a verified garage, even at
            2&nbsp;a.m.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
            <Link to="/login" className={primaryButton}>
              {t('nav.login')} <ArrowRight size={18} aria-hidden />
            </Link>
            <Link to="/about?topic=demo#contact" className={secondaryButton}>
              <CalendarCheck size={18} aria-hidden /> {t('nav.bookDemo')}
            </Link>
          </div>
        </div>
        <div className="flex justify-center">
          <img
            src={asset('logo-mark.png')}
            alt="EcoStream logo: a connected truck inside a green leaf-shaped E"
            className="w-56 sm:w-72 md:w-96"
          />
        </div>
      </section>

      {/* ---------- Five pillars ---------- */}
      <section className="bg-green-50">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">What EcoStream does</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {PILLARS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-navy-900/5">
                <Icon className="text-green-700" size={32} strokeWidth={1.75} aria-hidden />
                <h3 className="mt-3 text-sm font-bold uppercase tracking-wide">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-700">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">How it works</h2>
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
              {/* Arrow between steps: down on phones, right on wide screens */}
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

      {/* ---------- Owners / Drivers / Shippers ---------- */}
      <section className="bg-green-50">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Built for everyone on the trip</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {AUDIENCES.map(({ icon: Icon, title, points }) => (
              <article key={title} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-navy-900/5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-900 text-white">
                    <Icon size={22} aria-hidden />
                  </span>
                  <h3 className="text-lg font-bold">{title}</h3>
                </div>
                <ul className="mt-4 space-y-2">
                  {points.map((p) => (
                    <li key={p} className="flex gap-2 text-sm text-navy-700">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-500" aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Any truck ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-14 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">Works on any truck brand, any age</h2>
        <p className="mx-auto mt-3 max-w-2xl text-navy-700">
          Tyre sensors fit inside the wheel, so you don’t need a new truck. Works with Tata, Ashok Leyland, Eicher,
          BharatBenz and more.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/plans" className={primaryButton}>
            See plans & pricing <ArrowRight size={18} aria-hidden />
          </Link>
          <Link to="/about?topic=demo#contact" className={secondaryButton}>
            <CalendarCheck size={18} aria-hidden /> {t('nav.bookDemo')}
          </Link>
        </div>
      </section>
    </PublicLayout>
  )
}
