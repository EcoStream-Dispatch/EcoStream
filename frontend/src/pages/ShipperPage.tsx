import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  DoorClosed,
  FileText,
  Gauge,
  Inbox,
  Lock,
  LogOut,
  MapPin,
  Phone,
  Send,
  ShieldCheck,
  Snowflake,
  Truck,
  UserRound,
  Vibrate,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { getAlerts, getDrivers, getTrucks, USING_MOCK_DATA } from '../services/api'
import { useApi } from '../hooks/useApi'
import { LiveProvider, useLiveEvents, useThrottled } from '../services/live'
import { useAuth } from '../auth/AuthProvider'
import ParameterBoard from '../components/ParameterBoard'
import FleetMap from '../components/FleetMap'
import StatusBadge from '../components/StatusBadge'
import Wordmark from '../components/Wordmark'
import LanguageSwitch from '../components/LanguageSwitch'
import { ErrorBox, Loading } from '../components/PageState'
import { PLAN_NAME, planOf } from '../lib/plans'
import { ADD_ON_NAME, PARAMETERS, accessFor, derivedValues, type Access, type ParamValue } from '../lib/parameters'
import { timeAgo } from '../lib/format'
import { asset } from '../lib/asset'
import type { Driver, TruckSummary } from '../types'

/**
 * Shipper view (PREVIEW: shipper accounts and shipments are Phase 3).
 * Layout follows the Stitch v2 "Subscriber Portal" (Shipment Intelligence), redrawn in the light brand:
 * command bar with Sender / Receiver mode, live map with a transit strip and a ribbon,
 * milestone timeline, cold-chain and tamper cards, driver + truck strip, three bento pods,
 * then every data point the shipper login can see (ParameterBoard).
 *
 * Left out from Stitch on purpose: invented numbers (fleet unit counts, safety index, carbon score,
 * pharma set points), a real-looking phone number, and hot-linked photos.
 * There is no shipments table yet, so the shipment, its legs and times are a demo
 * (docs/FRONTEND_DATA_NEEDS.md). Sensor values come from the truck, locked when its plan lacks them.
 */
export default function ShipperPage() {
  return (
    <LiveProvider>
      <Shipment />
    </LiveProvider>
  )
}

interface DemoShipment {
  ref: string
  from: string
  to: string
  totalKm: number
  progress: number
  eta: string
  legs: { title: string; place: string; time: string }[]
}

/** Demo shipments, one per demo truck. Not in the database. */
const DEMO_SHIPMENT: Record<string, DemoShipment> = {
  'truck-1': {
    ref: 'DEMO-SHP-101',
    from: 'Namakkal',
    to: 'Chennai',
    totalKm: 360,
    progress: 0.6,
    eta: '6:00 PM',
    legs: [
      { title: 'Loaded', place: 'Namakkal yard', time: '6:00 AM · done' },
      { title: 'Checkpoint', place: 'Krishnagiri toll', time: '10:40 AM · cleared' },
      { title: 'On the road', place: 'NH 48', time: 'Live position' },
      { title: 'Delivery', place: 'Chennai', time: 'Expected 6:00 PM' },
    ],
  },
  'truck-2': {
    ref: 'DEMO-SHP-102',
    from: 'Chennai',
    to: 'Salem',
    totalKm: 340,
    progress: 0.72,
    eta: '4:00 PM',
    legs: [
      { title: 'Loaded', place: 'Chennai yard', time: '7:00 AM · done' },
      { title: 'Checkpoint', place: 'Vellore toll', time: '9:30 AM · cleared' },
      { title: 'On the road', place: 'NH 44', time: 'Live position' },
      { title: 'Delivery', place: 'Salem', time: 'Expected 4:00 PM' },
    ],
  },
}
const FALLBACK: DemoShipment = { ref: 'DEMO-SHP', from: 'Pickup', to: 'Drop', totalKm: 0, progress: 0, eta: 'not known yet', legs: [] }

type Mode = 'sender' | 'receiver'

/** One data point as the shipper sees it: its value, or why it's not on this truck. */
interface Slot {
  value: ParamValue | null
  locked: string | null
}

function useSlots(truck: TruckSummary) {
  return useMemo(() => {
    const plan = planOf(truck)
    const values: Record<string, ParamValue> = { ...(truck.params ?? {}), ...derivedValues(truck, null) }
    const lockText = (a: Access) =>
      a.kind === 'plan' ? `Comes with the ${PLAN_NAME[a.needs]} plan` : a.kind === 'addon' ? `Needs the ${ADD_ON_NAME[a.addOn]} add-on` : null
    return (key: string): Slot => {
      const def = PARAMETERS.find((d) => d.key === key)
      if (!def || !def.roles.includes('shipper')) return { value: null, locked: 'Not shared with shippers' }
      const access = accessFor(def, plan, truck.add_ons ?? [])
      return { value: access.kind === 'on' ? (values[key] ?? null) : null, locked: lockText(access) }
    }
  }, [truck])
}

function Shipment() {
  const { session, signOut } = useAuth()
  const trucksQ = useApi(getTrucks, [])
  const alertsQ = useApi(() => getAlerts(true), [])
  const driversQ = useApi(getDrivers, [])
  const refresh = useThrottled(() => {
    trucksQ.reload()
    alertsQ.reload()
  })
  useLiveEvents({ onReading: refresh, onAlert: refresh })

  const [truckIdx, setTruckIdx] = useState(0)
  const [mode, setMode] = useState<Mode>('sender')
  const truck = trucksQ.data?.[truckIdx] ?? trucksQ.data?.[0]
  const driver = driversQ.data?.find((d) => d.truck_id === truck?.id)

  return (
    <div className="min-h-screen bg-green-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link to="/" className="flex items-center gap-2" aria-label="EcoStream home">
            <img src={asset('logo-mark.png')} alt="" className="h-9 w-9 object-contain" />
            <Wordmark className="text-base" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <LanguageSwitch />
            </div>
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
          <ShipmentView
            truck={truck}
            driver={driver}
            mode={mode}
            setMode={setMode}
            picker={
              USING_MOCK_DATA && (trucksQ.data?.length ?? 0) > 1 ? (
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Demo: pick a shipment">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Demo: switch shipment</span>
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
              ) : null
            }
            alerts={alertsQ.data ?? []}
          />
        )}
      </main>
    </div>
  )
}

function ShipmentView({
  truck,
  driver,
  mode,
  setMode,
  picker,
  alerts,
}: {
  truck: TruckSummary
  driver?: Driver
  mode: Mode
  setMode: (m: Mode) => void
  picker: ReactNode
  alerts: Parameters<typeof ParameterBoard>[0]['alerts']
}) {
  const s = DEMO_SHIPMENT[truck.id] ?? FALLBACK
  const slot = useSlots(truck)
  const kmLeft = Math.round(s.totalKm * (1 - s.progress))

  return (
    <>
      {/* Command bar */}
      <section className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-md ring-1 ring-green-500/10 md:flex-row md:items-end md:justify-between md:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-bold text-green-700 ring-1 ring-green-500/30">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              LIVE TRACKING
            </span>
            <span className="font-mono text-xs text-navy-700">ID: {s.ref}</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-extrabold md:text-3xl">{truck.goods_type ?? 'Your shipment'}</h1>
          <p className="text-sm text-navy-700">
            {mode === 'sender' ? (
              <>
                From your <b className="text-navy-900">{s.from}</b> pickup to <b className="text-navy-900">{s.to}</b>
              </>
            ) : (
              <>
                Coming to you in <b className="text-navy-900">{s.to}</b> from <b className="text-navy-900">{s.from}</b>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-gray-100 p-1" role="group" aria-label="View as">
            {(
              [
                ['sender', 'Sender', Send],
                ['receiver', 'Receiver', Inbox],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                aria-pressed={mode === id}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition ${
                  mode === id ? 'bg-green-700 text-white shadow-sm' : 'text-navy-700 hover:bg-white'
                }`}
              >
                <Icon size={16} aria-hidden /> {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled
            title="Comes with shipper accounts (Phase 3)"
            className="inline-flex min-h-[44px] cursor-not-allowed items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-navy-700/60 ring-1 ring-gray-200"
          >
            <FileText size={16} aria-hidden /> e-Way bill / POD <span className="text-xs font-normal">(soon)</span>
          </button>
        </div>
      </section>

      {picker}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: map + timeline */}
        <div className="min-w-0 space-y-4 lg:col-span-8">
          <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200" aria-label="Live position">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-gray-100 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-green-300">
                  <Truck size={20} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="font-heading text-[10px] font-bold uppercase tracking-wider text-navy-700">Now</p>
                  <p className="truncate font-semibold">{slot('gps_position').value?.text ?? 'No position yet'}</p>
                </div>
              </div>
              <Metric label="Speed" slot={slot('vehicle_speed')} />
              <div className="sm:ml-auto">
                <p className="font-heading text-[10px] font-bold uppercase tracking-wider text-navy-700">{mode === 'sender' ? `Reaches ${s.to}` : 'Arrives'}</p>
                <p className="flex items-center gap-1 font-heading text-lg font-extrabold">
                  <Clock size={16} className="text-green-700" aria-hidden /> {s.eta}
                </p>
              </div>
            </div>
            <div className="p-3">
              <FleetMap trucks={[truck]} />
            </div>
            <dl className="grid grid-cols-2 divide-gray-100 border-t border-gray-100 sm:grid-cols-4 sm:divide-x">
              <Ribbon label="Distance left" value={s.totalKm ? `${kmLeft} km` : '—'} />
              <Ribbon label="Trip done" value={`${Math.round(s.progress * 100)}%`} />
              <Ribbon label="Last update" value={truck.last_seen_at ? timeAgo(truck.last_seen_at) : 'No data yet'} />
              <Ribbon label="Truck" value={truck.reg_no} />
            </dl>
          </section>

          <Timeline legs={s.legs} />
        </div>

        {/* Right: cargo cards */}
        <div className="min-w-0 space-y-4 lg:col-span-4">
          <ColdChain slot={slot('cargo_temp_humidity')} />
          <Tamper door={slot('cargo_door')} seal={slot('cargo_seal')} />
          <Pod icon={ShieldCheck} title="Vehicle condition" big={<StatusBadge status={truck.status} />}>
          <p className="text-sm text-navy-700">
            {truck.status === 'ok'
              ? 'Tyres are fine. No delay expected from the truck.'
              : truck.status === 'warning'
                ? 'A tyre needs a look. The owner has been alerted; the trip can continue for now.'
                : 'A tyre problem may stop the truck. The owner is arranging a garage, so expect a delay.'}
          </p>
          <PodFoot k="Tyres OK" v={`${truck.tyres.filter((t) => t.status === 'ok').length} of ${truck.tyres.length}`} />
        </Pod>
        </div>
      </div>

      <DriverStrip truck={truck} driver={driver} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Pod icon={Vibrate} title="Shocks on the road" big={<PodValue slot={slot('acceleration_events')} />}>
          <p className="text-sm text-navy-700">{slot('acceleration_events').value?.note ?? 'Hard braking, potholes and impacts, from the 3-axis sensor in the device.'}</p>
          <PodFoot k="Alert" v="Hard impact → tyre check" />
        </Pod>
        <Pod icon={Gauge} title="Speed" big={<PodValue slot={slot('vehicle_speed')} />}>
          <p className="text-sm text-navy-700">From the truck's own speed signal. The owner is alerted when the truck over-speeds.</p>
          <PodFoot k="Limit" v="90 km/h" />
        </Pod>
      </div>

      <ParameterBoard truck={truck} role="shipper" alerts={alerts} />
    </>
  )
}

function Metric({ label, slot }: { label: string; slot: Slot }) {
  return (
    <div>
      <p className="font-heading text-[10px] font-bold uppercase tracking-wider text-navy-700">{label}</p>
      {slot.value ? <p className="font-heading text-lg font-extrabold text-green-700">{slot.value.text}</p> : <p className="text-xs text-navy-700">{slot.locked ?? 'No data yet'}</p>}
    </div>
  )
}

function Ribbon({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <dt className="font-heading text-[10px] font-bold uppercase tracking-wider text-navy-700">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold">{value}</dd>
    </div>
  )
}

function Timeline({ legs }: { legs: DemoShipment['legs'] }) {
  if (!legs.length) return null
  const active = legs.findIndex((l) => l.time === 'Live position')
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-5" aria-labelledby="legs-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="legs-title" className="text-base font-bold">
          Trip milestones
        </h2>
        <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-navy-700">
          Leg {active + 1} of {legs.length}
        </span>
      </div>
      <ol className="mt-4 grid gap-4 md:grid-cols-4">
        {legs.map((l, i) => {
          const done = i < active
          const now = i === active
          const Icon = done ? CheckCircle2 : now ? Truck : i === legs.length - 1 ? Warehouse : MapPin
          return (
            <li key={l.title} className={`relative flex gap-3 md:flex-col ${!done && !now ? 'opacity-60' : ''}`}>
              {i < legs.length - 1 && <span className={`absolute left-5 top-11 h-[calc(100%-1.5rem)] w-0.5 md:left-11 md:top-5 md:h-0.5 md:w-[calc(100%-2rem)] ${done ? 'bg-green-500' : 'bg-gray-200'}`} aria-hidden />}
              <span
                className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  done ? 'bg-green-700 text-white' : now ? 'bg-green-100 text-green-700 ring-4 ring-green-500/25' : 'bg-gray-100 text-navy-700'
                }`}
              >
                <Icon size={20} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className={`font-heading text-[11px] font-bold uppercase tracking-wider ${now ? 'text-green-700' : 'text-navy-700'}`}>
                  {l.title}
                  {now && ' (now)'}
                </p>
                <p className="font-semibold">{l.place}</p>
                <p className="text-xs text-navy-700">{l.time}</p>
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-xs text-navy-700">Milestones are a demo until shipper accounts arrive (Phase 3).</p>
    </section>
  )
}

function CardHead({ icon: Icon, title, tag }: { icon: LucideIcon; title: string; tag: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <Icon size={18} className="text-green-700" aria-hidden /> {title}
      </h2>
      <span className="rounded bg-gray-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-navy-700/80">{tag}</span>
    </div>
  )
}

function ColdChain({ slot }: { slot: Slot }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-5">
      <CardHead icon={Snowflake} title="Cargo temperature" tag="Add-on" />
      <p className="mt-1 text-sm text-navy-700">Temperature and humidity inside the cargo box, for goods that must stay cool or dry.</p>
      {slot.value ? (
        <div className="mt-3 rounded-lg bg-green-50 p-3">
          <p className="font-heading text-3xl font-extrabold">{slot.value.text}</p>
          {slot.value.note && <p className="text-sm text-navy-700">{slot.value.note}</p>}
        </div>
      ) : (
        <LockedBox text={slot.locked ?? 'No data yet'} />
      )}
    </section>
  )
}

function Tamper({ door, seal }: { door: Slot; seal: Slot }) {
  const rows: { icon: LucideIcon; name: string; s: Slot }[] = [
    { icon: DoorClosed, name: 'Cargo door', s: door },
    { icon: Lock, name: 'Cargo lock / seal', s: seal },
  ]
  const anyOn = rows.some((r) => r.s.value)
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-5">
      <CardHead icon={ShieldCheck} title="Cargo security" tag="Add-on" />
      {anyOn ? (
        <ul className="mt-3 space-y-2">
          {rows.map(({ icon: Icon, name, s }) => {
            const ok = s.value?.status === 'ok'
            return (
              <li key={name} className="flex items-center gap-3 rounded-lg bg-gray-50 p-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-navy-700 ring-1 ring-gray-200">
                  <Icon size={18} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="truncate text-xs text-navy-700">{s.value?.note ?? s.locked}</p>
                </div>
                {s.value && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${ok ? 'bg-green-50 text-green-700 ring-green-500/30' : 'bg-red-50 text-critical ring-critical/30'}`}>
                    {s.value.text}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <LockedBox text={door.locked ?? 'No data yet'} />
      )}
      <p className="mt-3 text-xs text-navy-700">You and the owner are alerted if the door opens or the seal breaks away from a loading point.</p>
    </section>
  )
}

function LockedBox({ text }: { text: string }) {
  return (
    <p className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-sm text-navy-700 ring-1 ring-gray-200">
      <Lock size={16} className="shrink-0" aria-hidden /> Not on this truck. {text}.
    </p>
  )
}

function DriverStrip({ truck, driver }: { truck: TruckSummary; driver?: Driver }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 lg:flex-row lg:items-center md:p-5" aria-label="Driver and truck">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy-900 text-green-300">
          <UserRound size={28} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-[10px] font-bold uppercase tracking-wider text-navy-700">Driver</p>
          <p className="text-lg font-bold">{driver?.name ?? 'Not assigned yet'}</p>
          <p className="text-xs text-navy-700">The owner shares the driver's number once shipper accounts are live.</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-gray-50 p-3">
        <Truck size={22} className="shrink-0 text-green-700" aria-hidden />
        <div className="min-w-0">
          <p className="font-heading text-[10px] font-bold uppercase tracking-wider text-navy-700">Truck</p>
          <p className="font-bold">{truck.reg_no}</p>
          <p className="truncate text-xs text-navy-700">
            {truck.make} {truck.model} · EcoStream {PLAN_NAME[planOf(truck)]}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled className="inline-flex min-h-[44px] cursor-not-allowed items-center gap-1.5 rounded-lg bg-gray-100 px-3 text-sm font-semibold text-navy-700/60">
          <Phone size={16} aria-hidden /> Contact driver (soon)
        </button>
        <button type="button" disabled className="inline-flex min-h-[44px] cursor-not-allowed items-center gap-1.5 rounded-lg bg-green-700/50 px-3 text-sm font-semibold text-white">
          <ArrowDownToLine size={16} aria-hidden /> Proof of delivery (soon)
        </button>
      </div>
    </section>
  )
}

function Pod({ icon: Icon, title, big, children }: { icon: LucideIcon; title: string; big: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-5">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <Icon size={18} className="shrink-0 text-green-700" aria-hidden /> {title}
      </h2>
      <div className="mt-1.5">{big}</div>
      <div className="mt-2 flex flex-1 flex-col">{children}</div>
    </section>
  )
}

function PodValue({ slot }: { slot: Slot }) {
  if (!slot.value) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-navy-700"><Lock size={12} aria-hidden /> {slot.locked ?? 'No data yet'}</span>
  return <span className="font-heading text-xl font-extrabold text-navy-900">{slot.value.text}</span>
}

function PodFoot({ k, v }: { k: string; v: string }) {
  return (
    <p className="mt-auto flex justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs [*+&]:mt-3">
      <span className="font-bold uppercase tracking-wide text-navy-700">{k}</span>
      <span className="font-semibold">{v}</span>
    </p>
  )
}

