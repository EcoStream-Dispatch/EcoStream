import { Link, useLocation } from 'react-router-dom'
import { Construction } from 'lucide-react'
import { OWNER_NAV } from '../../components/AppLayout'
import { useLanguage } from '../../i18n/LanguageProvider'

/*
 * Placeholder for owner sections built in stage W4
 * (Predictive Maintenance, Shipments, Drivers, Garages, Reports, Plan & Billing, Settings).
 */
const WHAT: Record<string, string> = {
  '/owner/predictive': 'Fleet-wide risk ranking, cost if ignored vs cost to fix now, and a plan for this week.',
  '/owner/shipments': 'Shipment list, Create shipment (with suggested truck + driver) and live routing.',
  '/owner/drivers': 'Driver list, licence expiry, driving score and trip history.',
  '/owner/garages': 'Verified garage network on a map, and your bookings.',
  '/owner/reports': 'Monthly savings, tyre cost per km, fuel efficiency, idle time; PDF download.',
  '/owner/plan': 'Plan per truck, add-ons, upgrade / downgrade, invoices (no payments in the demo).',
  '/owner/settings': 'Users and roles, alert thresholds, notification channels, language.',
}

export default function ComingSoonPage() {
  const { pathname } = useLocation()
  const { t } = useLanguage()
  const base = Object.keys(WHAT).find((p) => pathname.startsWith(p)) ?? ''
  const item = OWNER_NAV.find((n) => n.to === base)
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <Construction size={40} className="mx-auto text-warning" aria-hidden />
      <h1 className="mt-3 text-2xl font-bold">{item ? t(item.label) : 'Coming soon'}</h1>
      <p className="mt-2 text-navy-700">This page is being built in the next stage (W4).</p>
      {WHAT[base] && <p className="mt-1 text-sm text-navy-700">It will show: {WHAT[base]}</p>}
      <Link to="/owner/dashboard" className="mt-6 inline-block rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-500">
        Back to dashboard
      </Link>
    </div>
  )
}
