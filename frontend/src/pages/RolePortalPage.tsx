import { Construction, Gauge, History, MapPinned, Navigation, PackageSearch, Receipt, Siren, type LucideIcon } from 'lucide-react'
import PortalShell from '../components/PortalShell'
import { PORTAL_HOME, type Role } from '../auth/roles'

/*
 * Landing page for the Driver and Shipper portals (stage W2).
 * It proves the login + role + route guard work end to end. The real screens
 * come in stage W5 (driver) and W6 (shipper); this page lists what's coming
 * and says plainly that it isn't built yet.
 */

const COMING: Record<'driver' | 'shipper', { stage: string; items: { icon: LucideIcon; title: string; text: string }[] }> = {
  driver: {
    stage: 'W5',
    items: [
      { icon: Navigation, title: 'My trip', text: 'Sender, receiver, route, ETA, Start trip / Reached.' },
      { icon: Gauge, title: 'Truck health', text: 'Big tyre diagram and simple engine, brake and battery icons.' },
      { icon: Siren, title: 'SOS', text: 'One big button that alerts the owner with your location.' },
      { icon: History, title: 'Trip history & rating', text: 'Past trips and tips to drive smoother.' },
    ],
  },
  shipper: {
    stage: 'W6',
    items: [
      { icon: PackageSearch, title: 'My shipments', text: 'Status and ETA of every shipment, and request a new one.' },
      { icon: MapPinned, title: 'Live tracking', text: 'Where the truck is, distance left, and truck condition.' },
      { icon: Receipt, title: 'Delivery & invoices', text: 'Proof of delivery and invoice downloads.' },
    ],
  },
}

export default function RolePortalPage({ role }: { role: Exclude<Role, 'owner'> }) {
  const { stage, items } = COMING[role]
  return (
    <PortalShell title={role === 'driver' ? 'portal.driver' : 'portal.shipper'} home={PORTAL_HOME[role]}>
      <h1 className="text-2xl font-bold">{role === 'driver' ? 'Vanakkam! Welcome, driver.' : 'Welcome to your shipper portal.'}</h1>
      <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-warning/40">
        <Construction size={18} className="mt-0.5 shrink-0" aria-hidden />
        You are logged in as a {role}. These screens are being built (stage {stage}). Here is what will appear:
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-navy-900/5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white">
              <Icon size={22} aria-hidden />
            </span>
            <span>
              <span className="block font-bold">{title}</span>
              <span className="block text-sm text-navy-700">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </PortalShell>
  )
}
