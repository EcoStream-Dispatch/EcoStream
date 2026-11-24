import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, LogOut, Package, Truck } from 'lucide-react'
import { getAlerts, getTrucks, USING_MOCK_DATA } from '../services/api'
import { useApi } from '../hooks/useApi'
import { LiveProvider, useLiveEvents, useThrottled } from '../services/live'
import { useAuth } from '../auth/AuthProvider'
import ParameterBoard from '../components/ParameterBoard'
import FleetMap from '../components/FleetMap'
import StatusBadge from '../components/StatusBadge'
import Wordmark from '../components/Wordmark'
import { ErrorBox, Loading } from '../components/PageState'
import { PLAN_NAME, planOf } from '../lib/plans'
import { timeAgo } from '../lib/format'
import { asset } from '../lib/asset'
import type { TruckSummary } from '../types'

/**
 * Shipper view (PREVIEW: shipper accounts and shipments are Phase 3).
 * Shows where the goods are, how the truck is doing, and the cargo data points
 * from lib/parameters.ts that the shipper role can see.
 *
 * There is no shipments table yet, so the shipment card below is a demo shipment
 * built from the truck (docs/FRONTEND_DATA_NEEDS.md).
 */
export default function ShipperPage() {
  return (
    <LiveProvider>
      <Shipment />
    </LiveProvider>
  )
}

/** Demo shipments, one per demo truck. Not in the database. */
const DEMO_SHIPMENT: Record<string, { ref: string; from: string; to: string; eta: string; progress: number }> = {
  'truck-1': { ref: 'DEMO-SHP-101', from: 'Namakkal', to: 'Chennai', eta: 'Today, about 6 PM', progress: 0.55 },
  'truck-2': { ref: 'DEMO-SHP-102', from: 'Chennai', to: 'Salem', eta: 'Today, about 4 PM', progress: 0.4 },
}

function Shipment() {
  const { session, signOut } = useAuth()
  const trucksQ = useApi(getTrucks, [])
  const alertsQ = useApi(() => getAlerts(true), [])
  const refresh = useThrottled(() => {
    trucksQ.reload()
    alertsQ.reload()
  })
  useLiveEvents({ onReading: refresh, onAlert: refresh })

  const [truckIdx, setTruckIdx] = useState(0)
  const truck = trucksQ.data?.[truckIdx] ?? trucksQ.data?.[0]

  return (
    <div className="min-h-screen bg-green-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link to="/" className="flex items-center gap-2" aria-label="EcoStream home">
            <img src={asset('logo-mark.png')} alt="" className="h-9 w-9 object-contain" />
            <Wordmark className="text-base" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap rounded-full bg-navy-900 px-2 py-0.5 text-xs font-semibold text-white">
              Shipper<span className="hidden sm:inline"> preview</span>
            </span>
            {USING_MOCK_DATA && (
              <span className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-warning/40">
                Demo<span className="hidden sm:inline"> data</span>
              </span>
            )}
            {session && (
              <button onClick={signOut} className="rounded-lg p-2 text-navy-700 hover:bg-gray-100" title="Log out">
                <LogOut size={20} aria-label="Log out" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-4 px-4 pb-10 pt-4">
        {trucksQ.loading && !trucksQ.data && <Loading what="your shipment" />}
        {trucksQ.error && <ErrorBox message={trucksQ.error} onRetry={trucksQ.reload} />}
        {trucksQ.data && !truck && <p className="text-navy-700">No shipment is linked to this login yet.</p>}

        {truck && (
          <>
            <ShipmentCard truck={truck} />
            {USING_MOCK_DATA && (trucksQ.data?.length ?? 0) > 1 && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Demo: pick a shipment">
                <span className="text-xs font-semibold text-navy-700">Demo shipments:</span>
                {trucksQ.data!.map((tk, i) => (
                  <button
                    key={tk.id}
                    type="button"
                    onClick={() => setTruckIdx(i)}
                    aria-pressed={tk.id === truck.id}
                    className={`min-h-[32px] rounded-full px-2.5 text-xs font-semibold ring-1 ${
                      tk.id === truck.id ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-navy-700 ring-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {tk.goods_type ?? tk.reg_no} · {PLAN_NAME[planOf(tk)]}
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-12">
              <div className="min-w-0 lg:col-span-8">
                <FleetMap trucks={[truck]} />
              </div>
              <VehicleCondition truck={truck} className="lg:col-span-4" />
            </div>

            <ParameterBoard truck={truck} role="shipper" alerts={alertsQ.data ?? []} />
          </>
        )}
      </main>
    </div>
  )
}

function ShipmentCard({ truck }: { truck: TruckSummary }) {
  const s = DEMO_SHIPMENT[truck.id] ?? { ref: 'DEMO-SHP', from: 'Pickup', to: 'Drop', eta: 'Not known yet', progress: 0 }
  const pct = Math.round(s.progress * 100)
  return (
    <section className="rounded-xl bg-white p-4 shadow-md ring-1 ring-green-500/10" aria-labelledby="shipment-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-green-300">
            <Package size={26} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 id="shipment-title" className="text-xl font-extrabold md:text-2xl">
              {truck.goods_type ?? 'Your shipment'}
            </h1>
            <p className="text-sm text-navy-700">
              {s.ref} · <Truck size={14} className="inline align-[-2px]" aria-hidden /> {truck.reg_no}
            </p>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">
          <Clock size={16} className="text-green-700" aria-hidden /> ETA {s.eta}
        </p>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-sm font-semibold text-navy-900">
          <span>{s.from}</span>
          <span>{s.to}</span>
        </div>
        <div
          className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-100"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Trip progress"
        >
          <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-xs text-navy-700">About {pct}% of the way. Shipment details are a demo until shipper accounts arrive (Phase 3).</p>
      </div>
    </section>
  )
}

function VehicleCondition({ truck, className = '' }: { truck: TruckSummary; className?: string }) {
  const okTyres = truck.tyres.filter((t) => t.status === 'ok').length
  const line =
    truck.status === 'ok'
      ? 'The truck is in good shape. No delay expected from the vehicle.'
      : truck.status === 'warning'
        ? 'A tyre needs a look. The owner has been alerted and the trip can continue for now.'
        : 'A tyre problem may stop the truck. The owner is arranging a garage, so expect a delay.'
  return (
    <section className={`min-w-0 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 ${className}`} aria-labelledby="vehicle-title">
      <h2 id="vehicle-title" className="text-sm font-bold uppercase tracking-wide text-navy-700">
        Vehicle condition
      </h2>
      <div className="mt-2">
        <StatusBadge status={truck.status} />
      </div>
      <p className="mt-2 text-sm text-navy-900">{line}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-navy-700">Tyres OK</dt>
          <dd className="font-semibold">
            {okTyres} of {truck.tyres.length}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-navy-700">Last update</dt>
          <dd className="font-semibold">{truck.last_seen_at ? timeAgo(truck.last_seen_at) : 'No data yet'}</dd>
        </div>
        <div>
          <dt className="text-xs text-navy-700">Open alerts</dt>
          <dd className="font-semibold">{truck.open_alerts}</dd>
        </div>
        <div>
          <dt className="text-xs text-navy-700">Truck</dt>
          <dd className="font-semibold">
            {truck.make} {truck.model}
          </dd>
        </div>
      </dl>
    </section>
  )
}
