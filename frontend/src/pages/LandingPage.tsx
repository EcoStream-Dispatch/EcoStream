import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  BellRing,
  Cloud,
  Fuel,
  MapPin,
  Radio,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import Wordmark from '../components/Wordmark'
import { asset } from '../lib/asset'

/*
 * Public landing page.
 * Rule: no fake customer logos, testimonials or made-up numbers here.
 */

// The five pillars from our logo.
const PILLARS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: MapPin, title: 'Real-Time Tracking', text: 'See where each truck is and how its tyres are doing, live.' },
  { icon: Fuel, title: 'Fuel Efficiency', text: 'Correct tyre pressure means less rolling resistance and less diesel burnt.' },
  { icon: Wrench, title: 'Predictive Maintenance', text: 'Spot a slow leak or a hot tyre early, before it becomes a breakdown.' },
  { icon: ShieldCheck, title: 'Safety Assurance', text: 'Fewer blowouts on the highway, for drivers and everyone around them.' },
  { icon: BarChart3, title: 'Smart Insights', text: 'Pressure and temperature history for every tyre, in one place.' },
]

// "How it works": the path a reading takes, from the tyre to a garage.
const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Radio, title: 'Sensor', text: 'A sensor in each tyre measures pressure and temperature.' },
  { icon: Cloud, title: 'Cloud', text: 'Readings go to the cloud, corrected for temperature.' },
  { icon: BellRing, title: 'Alert', text: 'The owner is alerted to a slow leak, low pressure or overheating.' },
  { icon: Wrench, title: 'Garage', text: 'We show the nearest verified garages that are open now.' },
]

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:py-20">
          <div className="text-center md:text-left">
            <h1 className="text-4xl sm:text-5xl">
              <Wordmark />
            </h1>
            <p className="mt-3 font-heading text-sm font-semibold tracking-[0.2em] text-green-700 sm:text-base">
              PREDICT · PROTECT · PERFORM
            </p>
            <p className="mt-6 text-lg leading-relaxed text-navy-700 sm:text-xl">
              Know a tyre or engine problem before it stops your truck, and get to a verified
              garage, even at 2&nbsp;a.m.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-6 py-3 font-semibold text-white transition hover:bg-green-500"
              >
                Login <ArrowRight size={18} aria-hidden />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-lg border border-navy-900/15 px-6 py-3 font-semibold text-navy-900 transition hover:border-green-300 hover:bg-green-50"
              >
                How it works
              </a>
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
      </main>

      <Footer />
    </div>
  )
}
