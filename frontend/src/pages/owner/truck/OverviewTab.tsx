import { Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BatteryMedium, CircleDot, Cog, Disc3, Lock, Package, Phone } from 'lucide-react'
import { PARAMS, type ParamGroup } from '../../../data/plans'
import { ALERT_TITLE, formatAlertValue } from '../../../lib/status'
import { timeAgo } from '../../../lib/format'
import { positionName } from '../../../lib/tyreLayout'
import { plannedRoute } from '../../../lib/route'
import { Card, CardTitle, DemoTag } from '../../../components/owner/ui'
import StatusBadge from '../../../components/StatusBadge'
import type { Alert, TruckDetails, TruckSummary, TyreStatus } from '../../../types'
import { isUnlocked, worst, worstTyreStatus, type TabId } from './tabs'

const FleetMap = lazy(() => import('../../../components/owner/FleetMap'))

/*
 * Overview tab: live location mini-map, current trip (sender -> receiver, ETA),
 * health per system (Tyres, Engine, Brakes, Power, Cargo) and active alerts.
 */

const SYSTEMS: { name: string; icon: typeof Cog; groups: ParamGroup[]; tab: TabId }[] = [
  { name: 'Engine', icon: Cog, groups: ['Engine', 'Fuel'], tab: 'engine' },
  { name: 'Brakes', icon: Disc3, groups: ['Brakes & Chassis'], tab: 'brakes' },
  { name: 'Power', icon: BatteryMedium, groups: ['Power', 'Device'], tab: 'power' },
  { name: 'Cargo', icon: Package, groups: ['Cargo'], tab: 'cargo' },
]

export default function OverviewTab({ truck, details, openAlerts }: { truck: TruckSummary; details: TruckDetails; openAlerts: Alert[] }) {
  const s = details.shipment
  const route = s ? plannedRoute([s.sender.lat, s.sender.lon], [s.receiver.lat, s.receiver.lon]) : undefined
  const values = new Map(details.params.map((v) => [v.key, v]))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle>Live location</CardTitle>
        {truck.lat == null ? (
          <p className="text-sm text-navy-700">No location yet.</p>
        ) : (
          <Suspense fallback={<div className="flex h-60 items-center justify-center rounded-lg bg-gray-100 text-sm">Loading map…</div>}>
            <FleetMap trucks={[truck]} route={route} selectedId={truck.id} className="h-60" />
          </Suspense>
        )}
        <p className="mt-2 text-xs text-navy-700">
          Last position {timeAgo(truck.last_seen_at)}
          {route && ' · dashed line: planned route'}
        </p>
      </Card>

      <Card>
        <CardTitle right={<DemoTag />}>Current trip</CardTitle>
        {s ? (
          <>
            <Link to={`/owner/shipments/${s.id}`} className="font-heading text-xs font-bold text-green-700 hover:text-green-500">
              {s.id} · live routing →
            </Link>
            <ol className="mt-2 space-y-3">
              {[
                { label: 'From', p: s.sender },
                { label: 'To', p: s.receiver },
              ].map(({ label, p }) => (
                <li key={label} className="flex gap-3">
                  <CircleDot size={18} className="mt-0.5 shrink-0 text-green-700" aria-hidden />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-xs uppercase tracking-wide text-navy-700">{label}</p>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-navy-700">{p.address}</p>
                  </div>
                  <a href={`tel:${p.phone.replace(/\s/g, '')}`} className="self-center rounded-lg p-2 text-green-700 hover:bg-green-50" aria-label={`Call ${p.contact}`}>
                    <Phone size={18} aria-hidden />
                  </a>
                </li>
              ))}
            </ol>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg bg-gray-50 p-2">
                <dt className="text-xs text-navy-700">Goods</dt>
                <dd className="font-semibold">{s.goods}</dd>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <dt className="text-xs text-navy-700">ETA</dt>
                <dd className="font-semibold">
                  {s.eta ? new Date(s.eta).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '-'}
                  {s.status === 'delayed' && <span className="block text-xs text-critical">Delayed</span>}
                </dd>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <dt className="text-xs text-navy-700">Distance left</dt>
                <dd className="font-semibold">{s.distance_left_km != null ? `${s.distance_left_km} km` : '-'}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="text-sm text-navy-700">This truck is not on a shipment.</p>
        )}
      </Card>

      <Card>
        <CardTitle>Health by system</CardTitle>
        <ul className="divide-y divide-gray-100">
          <SystemRow name="Tyres" icon={CircleDot} to={`?tab=tyres`} status={worstTyreStatus(truck.tyres.map((t) => t.status))} />
          {SYSTEMS.map((sys) => {
            const params = PARAMS.filter((p) => sys.groups.includes(p.group) && isUnlocked(p, details.profile))
            const status = params.length ? worst(params.map((p) => values.get(p.key)!).filter(Boolean)) : null
            return <SystemRow key={sys.name} name={sys.name} icon={sys.icon} to={`?tab=${sys.tab}`} status={status} />
          })}
        </ul>
        <p className="mt-2 text-xs text-navy-700">Tyres: live sensor data. Other systems: sample data.</p>
      </Card>

      <Card>
        <CardTitle right={<Link to={`/owner/alerts?truck=${truck.id}`} className="text-sm font-semibold text-green-700 hover:text-green-500">All alerts →</Link>}>
          Active alerts
        </CardTitle>
        {openAlerts.length === 0 ? (
          <p className="text-sm text-green-700">No open alerts.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {openAlerts.map((a) => {
              const tyre = truck.tyres.find((t) => t.id === a.tyre_id)
              return (
                <li key={a.id} className="flex items-start justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {ALERT_TITLE[a.type]} · {tyre ? positionName(tyre.position) : 'tyre'}
                    </p>
                    <p className="text-xs text-navy-700">
                      {formatAlertValue(a.type, a.value)} · {timeAgo(a.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={a.severity} />
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

function SystemRow({ name, icon: Icon, to, status }: { name: string; icon: typeof Cog; to: string; status: TyreStatus | null }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 py-2.5 hover:text-green-700">
        <Icon size={18} className="shrink-0 text-navy-700" aria-hidden />
        <span className="flex-1 font-semibold">{name}</span>
        {status ? (
          <StatusBadge status={status} />
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-300">
            <Lock size={12} aria-hidden /> Not in plan
          </span>
        )}
        <ArrowRight size={14} className="text-navy-700" aria-hidden />
      </Link>
    </li>
  )
}
