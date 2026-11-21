import { Link, NavLink, Outlet } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, OctagonAlert, Plus, WifiOff, type LucideIcon } from 'lucide-react'
import PortalShell from '../../components/PortalShell'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { TruckCondition } from '../../types'

/*
 * Shipper portal shell (docs/WEBSITE_SPEC.md section 4, stage W6):
 * top bar (from PortalShell), tabs "My shipments" / "Delivery & invoices",
 * and a "Request a shipment" button. Sample data for now.
 */
export default function ShipperLayout() {
  const { t } = useLanguage()
  const tab = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${isActive ? 'border-green-700 text-green-700' : 'border-transparent text-navy-700'}`
  return (
    <PortalShell title="portal.shipper" home="/shipper">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-gray-200 print:hidden">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Shipper">
          <NavLink to="/shipper" end className={tab}>
            {t('shipper.shipments')}
          </NavLink>
          <NavLink to="/shipper/deliveries" className={tab}>
            {t('shipper.deliveries')}
          </NavLink>
        </nav>
        <Link to="/shipper/request" className="mb-2 inline-flex items-center gap-1 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500">
          <Plus size={16} aria-hidden /> {t('shipper.request')}
        </Link>
      </div>
      <Outlet />
    </PortalShell>
  )
}

const CONDITION: Record<TruckCondition, { label: string; icon: LucideIcon; cls: string }> = {
  good: { label: 'Good', icon: CheckCircle2, cls: 'bg-green-50 text-green-700 ring-green-500/30' },
  minor: { label: 'Minor issue, being handled', icon: AlertTriangle, cls: 'bg-amber-50 text-amber-800 ring-warning/40' },
  problem: { label: 'Problem, transporter is on it', icon: OctagonAlert, cls: 'bg-red-50 text-critical ring-critical/30' },
  no_signal: { label: 'No signal right now', icon: WifiOff, cls: 'bg-gray-100 text-gray-600 ring-gray-300' },
}

/** "Truck condition: Good" in plain words, icon + word (never colour alone). */
export function ConditionBadge({ c }: { c: TruckCondition }) {
  const { label, icon: Icon, cls } = CONDITION[c]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${cls}`}>
      <Icon size={14} aria-hidden /> {label}
    </span>
  )
}
