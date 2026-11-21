import { Suspense, lazy, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BellRing, Clock, Package, UserRound, X } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useOwnerData } from '../../hooks/useOwnerData'
import { getAllGarages, getMapLayers, truckExtrasFor } from '../../services/api'
import { truckHealth } from '../../lib/status'
import { timeAgo } from '../../lib/format'
import { Card, DemoTag, PageHeader, PlanBadge } from '../../components/owner/ui'
import { MapLegend, type LayerKey } from '../../components/owner/mapStyle'
import { ErrorBox, Loading } from '../../components/PageState'
import StatusBadge from '../../components/StatusBadge'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { PlanId } from '../../data/plans'
import type { Shipment, TruckSummary, TyreStatus } from '../../types'

const FleetMap = lazy(() => import('../../components/owner/FleetMap'))

/*
 * Live Map (docs/WEBSITE_SPEC.md section 2.2): all trucks with status pins,
 * filters, a side panel for the selected truck, and switchable layers.
 * Garages, dead zones, ghats and bad roads are sample data for now.
 */

const LAYERS: { key: LayerKey; label: string }[] = [
  { key: 'garages', label: 'Verified garages' },
  { key: 'dead_zones', label: 'No-signal zones' },
  { key: 'ghats', label: 'Ghat stretches' },
  { key: 'bad_roads', label: 'Bad roads' },
]

type ShipFilter = 'all' | 'on' | 'none'

export default function LiveMapPage() {
  const { t } = useLanguage()
  const { trucks, shipments, loading, error, reload } = useOwnerData()
  const garagesQ = useApi(getAllGarages, [])
  const layersQ = useApi(getMapLayers, [])

  const [status, setStatus] = useState<TyreStatus | 'all'>('all')
  const [plan, setPlan] = useState<PlanId | 'all'>('all')
  const [ship, setShip] = useState<ShipFilter>('all')
  const [show, setShow] = useState<Partial<Record<LayerKey, boolean>>>({ garages: true, ghats: true })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const shipmentOf = useMemo(() => new Map((shipments ?? []).filter((s) => s.truck_id).map((s) => [s.truck_id!, s])), [shipments])
  const visible = useMemo(
    () =>
      (trucks ?? []).filter((tr) => {
        if (status !== 'all' && truckHealth(tr) !== status) return false
        if (plan !== 'all' && truckExtrasFor(tr).plan !== plan) return false
        const onTrip = shipmentOf.has(tr.id) && shipmentOf.get(tr.id)!.status !== 'delivered'
        if (ship === 'on' && !onTrip) return false
        if (ship === 'none' && onTrip) return false
        return true
      }),
    [trucks, status, plan, ship, shipmentOf],
  )

  if (loading && !trucks) return <Loading what="map" />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  const selected = visible.find((tr) => tr.id === selectedId) ?? null
  const verifiedGarages = (garagesQ.data ?? []).filter((g) => g.verified)

  return (
    <>
      <PageHeader title={t('owner.map')} subtitle={`${visible.length} of ${trucks?.length ?? 0} trucks shown`} />

      {/* Filters */}
      <div className="mb-3 flex flex-wrap gap-2">
        <Select label="Status" value={status} onChange={(v) => setStatus(v as TyreStatus | 'all')}
          options={[['all', 'All statuses'], ['ok', t('status.ok')], ['warning', t('status.warning')], ['critical', t('status.critical')], ['offline', t('status.offline')]]} />
        <Select label="Plan" value={plan} onChange={(v) => setPlan(v as PlanId | 'all')}
          options={[['all', 'All plans'], ['lite', 'Lite'], ['pro', 'Pro'], ['fleet', 'Fleet']]} />
        <Select label="Shipment" value={ship} onChange={(v) => setShip(v as ShipFilter)}
          options={[['all', 'All trucks'], ['on', 'On a shipment'], ['none', 'No shipment']]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="p-2 sm:p-3">
          <Suspense fallback={<div className="flex h-[60vh] items-center justify-center rounded-lg bg-gray-100 text-sm text-navy-700">Loading map…</div>}>
            <FleetMap
              trucks={visible}
              garages={verifiedGarages}
              layers={layersQ.data ?? undefined}
              show={show}
              selectedId={selectedId}
              onSelect={setSelectedId}
              className="h-[55vh] min-h-[320px] lg:h-[68vh]"
            />
          </Suspense>
          <MapLegend show={show} />
          {/* Layer switches */}
          <fieldset className="mt-3 border-t border-gray-100 pt-3">
            <legend className="sr-only">Map layers</legend>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {LAYERS.map((l) => (
                <label key={l.key} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!show[l.key]}
                    onChange={(e) => setShow((s) => ({ ...s, [l.key]: e.target.checked }))}
                    className="h-4 w-4 accent-green-700"
                  />
                  {l.label}
                </label>
              ))}
              <DemoTag />
            </div>
          </fieldset>
        </Card>

        {/* Side panel */}
        <Card>
          {selected ? (
            <TruckPanel truck={selected} shipment={shipmentOf.get(selected.id)} onClose={() => setSelectedId(null)} />
          ) : (
            <>
              <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700">Trucks</h2>
              <p className="mt-1 text-xs text-navy-700">Tap a pin on the map, or a truck below.</p>
              <ul className="mt-3 divide-y divide-gray-100">
                {visible.map((tr) => (
                  <li key={tr.id}>
                    <button onClick={() => setSelectedId(tr.id)} className="flex w-full items-center justify-between gap-2 py-2.5 text-left hover:text-green-700">
                      <span className="min-w-0">
                        <span className="block font-semibold">{tr.reg_no}</span>
                        <span className="block truncate text-xs text-navy-700">
                          {tr.make} {tr.model}
                        </span>
                      </span>
                      <StatusBadge status={truckHealth(tr)} />
                    </button>
                  </li>
                ))}
                {visible.length === 0 && <li className="py-3 text-sm text-navy-700">No trucks match these filters.</li>}
              </ul>
            </>
          )}
        </Card>
      </div>
    </>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-gray-200">
      <span className="font-semibold text-navy-700">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent font-semibold text-navy-900 focus:outline-none">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}

function TruckPanel({ truck, shipment, onClose }: { truck: TruckSummary; shipment?: Shipment; onClose: () => void }) {
  const extras = truckExtrasFor(truck)
  const counts = truck.tyres.reduce<Record<string, number>>((c, ty) => ({ ...c, [ty.status]: (c[ty.status] ?? 0) + 1 }), {})
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{truck.reg_no}</h2>
          <p className="text-sm text-navy-700">
            {truck.make} {truck.model} · <PlanBadge plan={extras.plan} />
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-navy-700 hover:bg-gray-100" aria-label="Close truck panel">
          <X size={18} aria-hidden />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={truckHealth(truck)} className="text-sm" />
        <span className="inline-flex items-center gap-1 text-xs text-navy-700">
          <Clock size={12} aria-hidden /> Last seen {timeAgo(truck.last_seen_at)}
        </span>
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        <Row icon={UserRound} label="Driver">
          {extras.driver ? `${extras.driver.name} · ${extras.driver.phone}` : 'No driver assigned'}
        </Row>
        <Row icon={Package} label="Shipment">
          {shipment ? `${shipment.id}: ${shipment.sender.city} → ${shipment.receiver.city}${shipment.distance_left_km != null ? `, ${shipment.distance_left_km} km left` : ''}` : 'None'}
        </Row>
        <Row icon={BellRing} label="Open alerts">
          {truck.open_alerts}
        </Row>
      </dl>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-navy-700">Tyres</p>
      <p className="mt-1 text-sm">
        {(['critical', 'warning', 'offline', 'ok'] as const)
          .filter((s) => counts[s])
          .map((s) => `${counts[s]} ${s === 'ok' ? 'OK' : s}`)
          .join(' · ')}
      </p>
      <Link
        to={`/owner/trucks/${truck.id}`}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 font-semibold text-white hover:bg-green-500"
      >
        Open truck <ArrowRight size={16} aria-hidden />
      </Link>
    </div>
  )
}

function Row({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <Icon size={16} className="mt-0.5 shrink-0 text-green-700" aria-hidden />
      <div>
        <dt className="text-xs text-navy-700">{label}</dt>
        <dd className="font-semibold">{children}</dd>
      </div>
    </div>
  )
}
