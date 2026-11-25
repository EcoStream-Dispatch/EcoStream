import { Lightbulb } from 'lucide-react'
import { driverScoreTrend, driverTrips } from '../../services/api'
import { Sparkline, formatDate } from '../../components/owner/ui'
import { useLanguage } from '../../i18n/LanguageProvider'
import { useDriver } from './DriverLayout'

/*
 * Driver: trip history and my rating (docs/WEBSITE_SPEC.md section 3.5).
 * Past trips, driving score (0-100) with simple tips. Sample data.
 */

const TIPS = [
  'Smoother braking saves tyres and fuel.',
  'On ghat roads, use a lower gear instead of holding the brake.',
  'Check tyre pressure when the tyres are cold, before you start.',
  'Less idling = more km per litre.',
]

export default function DriverHistoryPage() {
  const { t } = useLanguage()
  const { home } = useDriver()
  const d = home.driver
  const trips = driverTrips(d.id)
  const tone = d.score >= 80 ? 'text-green-700' : d.score >= 65 ? 'text-amber-800' : 'text-critical'

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-gray-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-navy-700">{t('driver.score')}</p>
        <p className={`font-heading text-6xl font-extrabold ${tone}`}>
          {d.score}
          <span className="text-xl text-navy-700"> / 100</span>
        </p>
        <Sparkline values={driverScoreTrend(d.score)} className="mt-2 h-12" />
        <p className="text-xs text-navy-700">Last 8 weeks</p>
      </section>

      <section className="rounded-2xl bg-green-50 p-4 ring-1 ring-green-500/30">
        <ul className="space-y-2">
          {TIPS.map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-lg">
              <Lightbulb size={22} className="mt-0.5 shrink-0 text-green-700" aria-hidden /> {tip}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
        <h2 className="px-4 pt-4 text-sm font-bold uppercase tracking-wide text-navy-700">{t('driver.history')}</h2>
        <ul className="divide-y divide-gray-100">
          {trips.map((tr, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="block text-lg font-bold">
                  {tr.from} → {tr.to}
                </span>
                <span className="text-sm text-navy-700">
                  {formatDate(tr.date)} · {tr.km} km
                </span>
              </span>
              <span className="text-right">
                <span className="block font-heading text-2xl font-extrabold">{tr.score}</span>
                <span className="text-xs text-navy-700">score</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
