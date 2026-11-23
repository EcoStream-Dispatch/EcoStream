import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Gauge, Lock, LogOut, MapPin, Navigation, Phone, Volume2, Wrench } from 'lucide-react'
import { getAlerts, getNearestGarages, getTrucks } from '../services/api'
import { useApi } from '../hooks/useApi'
import { LiveProvider, useLiveEvents, useThrottled } from '../services/live'
import { useAuth } from '../auth/AuthProvider'
import TyreLayout from '../components/TyreLayout'
import FleetMap from '../components/FleetMap'
import StatusBadge from '../components/StatusBadge'
import Pressure from '../components/Pressure'
import Wordmark from '../components/Wordmark'
import { ErrorBox, Loading } from '../components/PageState'
import { ALERT_TITLE, STATUS_STYLE } from '../lib/status'
import { positionName } from '../lib/tyreLayout'
import { timeAgo } from '../lib/format'
import { asset } from '../lib/asset'
import { USING_MOCK_DATA } from '../services/api'
import type { Alert, TruckSummary } from '../types'

/**
 * Driver "Live cockpit" (Stitch: Driver Portal, redrawn in the light brand; App Screens sheet:
 * "Live cockpit - tyre status, next garage"). One glance, one tap:
 *   - big alert banner when something is wrong (navy, readable at night), with
 *     Play voice / Navigate to garage
 *   - tyre layout, next open garage, map
 * Engine data is Phase 4 (CAN/J1939), so that card is shown locked.
 * Trip / order details are Phase 3, so they are left out.
 *
 * NOTE: there are no driver accounts in the backend yet. For now this shows the first
 * truck the logged-in account can see (in demo mode: TN 99 ZZ 0001).
 */
export default function DriverPage() {
  return (
    <LiveProvider>
      <Cockpit />
    </LiveProvider>
  )
}

const RANK = { critical: 2, warning: 1 } as const

function Cockpit() {
  const { session, signOut } = useAuth()
  const trucksQ = useApi(getTrucks, [])
  const alertsQ = useApi(() => getAlerts(true), [])
  const refresh = useThrottled(() => {
    trucksQ.reload()
    alertsQ.reload()
  })
  useLiveEvents({ onReading: refresh, onAlert: refresh })

  const truck = trucksQ.data?.[0]
  const alert = (alertsQ.data ?? [])
    .filter((a) => a.truck_id === truck?.id)
    .sort((a, b) => RANK[b.severity] - RANK[a.severity])[0]

  return (
    <div className="min-h-screen bg-green-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link to="/" className="flex items-center gap-2" aria-label="EcoStream home">
            <img src={asset('logo-mark.png')} alt="" className="h-9 w-9 object-contain" />
            <Wordmark className="text-base" />
          </Link>
          <div className="flex items-center gap-2">
            {USING_MOCK_DATA && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-warning/40">
                Demo data
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

      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold">Live cockpit</h1>
          {truck && (
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider ring-1 ring-green-500/20">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" aria-hidden />
              {truck.reg_no} · seen {timeAgo(truck.last_seen_at)}
            </span>
          )}
        </div>

        {trucksQ.loading && !trucksQ.data && <Loading what="your truck" />}
        {trucksQ.error && <ErrorBox message={trucksQ.error} onRetry={trucksQ.reload} />}
        {trucksQ.data && !truck && <p className="mt-4 text-navy-700">No truck is linked to this login yet.</p>}

        {truck && (
          <>
            <div className="mt-4">
              {alert ? <AlertBanner alert={alert} truck={truck} /> : <AllGood />}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12">
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-green-500/15 md:col-span-5">
                <h2 className="text-lg font-bold">Tyres</h2>
                <TyreBoard truck={truck} />
              </section>

              <div className="flex flex-col gap-4 md:col-span-7">
                <NextGarage truck={truck} />
                <FleetMap trucks={[truck]} />
                <div className="rounded-2xl bg-white p-5 opacity-70 shadow-sm ring-1 ring-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="inline-flex items-center gap-2 text-lg font-bold">
                      <Gauge size={20} aria-hidden /> Engine
                    </h2>
                    <Lock size={18} className="text-navy-700" aria-hidden />
                  </div>
                  <p className="mt-2 text-sm text-navy-700">Coolant, oil temperature and fault codes come in a later update.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function AllGood() {
  const { icon: Icon } = STATUS_STYLE.ok
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-green-500/30">
      <Icon size={40} className="shrink-0 text-green-500" aria-hidden />
      <div>
        <p className="text-xl font-bold">All tyres OK</p>
        <p className="text-sm text-navy-700">Drive safe. We'll warn you here if anything changes.</p>
      </div>
    </div>
  )
}

/** Big, plain alert for the driver. Navy so it's readable at night; Tamil line under English. */
function AlertBanner({ alert, truck }: { alert: Alert; truck: TruckSummary }) {
  const pos = truck.tyres.find((t) => t.id === alert.tyre_id)?.position
  const where = pos ? positionName(pos) : 'a tyre'
  const offline = alert.type === 'sensor_offline'
  const action =
    alert.severity === 'critical'
      ? 'Stop safely now.'
      : offline
        ? 'Check the tyre at your next stop.'
        : 'Drive slowly to the next garage.'
  const en = `${ALERT_TITLE[alert.type]} on ${where}. ${action}`
  // Tamil: first draft, needs native review (see src/lib/i18n.tsx)
  const ta =
    alert.severity === 'critical'
      ? 'டயரில் பிரச்சனை. உடனே பாதுகாப்பாக நிறுத்துங்கள்.'
      : offline
        ? 'டயர் சென்சார் தகவல் வரவில்லை. அடுத்த நிறுத்தத்தில் டயரைச் சரிபாருங்கள்.'
        : 'டயரில் பிரச்சனை. மெதுவாக அடுத்த கேரேஜுக்குச் செல்லுங்கள்.'
  const { icon: Icon } = STATUS_STYLE[alert.severity]
  const [speaking, setSpeaking] = useState(false)

  function playVoice() {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const ta1 = new SpeechSynthesisUtterance(ta)
    ta1.lang = 'ta-IN'
    const en1 = new SpeechSynthesisUtterance(en)
    en1.lang = 'en-IN'
    en1.onend = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(ta1)
    window.speechSynthesis.speak(en1)
  }

  return (
    <div className="rounded-2xl bg-navy-900 p-5 text-white shadow-lg md:p-6">
      <div className="flex items-start gap-4">
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${alert.severity === 'critical' ? 'bg-critical' : 'bg-warning text-navy-900'}`}
        >
          <Icon size={30} aria-hidden />
        </span>
        <div className="min-w-0">
          <StatusBadge status={alert.severity} className="mb-2" />
          <p className="text-xl font-bold leading-snug md:text-2xl">{en}</p>
          <p lang="ta" className="mt-1 text-lg text-white/85">
            {ta}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={playVoice}
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-white font-semibold text-navy-900 hover:bg-green-50"
        >
          <Volume2 size={20} aria-hidden /> {speaking ? 'Playing…' : 'Play voice'}
        </button>
        <a
          href="#next-garage"
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-green-300 font-semibold text-navy-900 hover:bg-white"
        >
          <Navigation size={20} aria-hidden /> Nearest garage
        </a>
        <span
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-white/30 font-semibold text-white/60"
          title="Owner's number isn't stored yet"
        >
          <Phone size={20} aria-hidden /> Call owner (soon)
        </span>
      </div>
    </div>
  )
}

function TyreBoard({ truck }: { truck: TruckSummary }) {
  const [selected, setSelected] = useState<string | null>(null)
  const tyre = truck.tyres.find((t) => t.id === selected)
  return (
    <>
      <div className="mx-auto mt-3 max-w-[240px]">
        <TyreLayout axleConfig={truck.axle_config} tyres={truck.tyres} selectedId={selected} onSelect={setSelected} />
      </div>
      <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm">
        {tyre ? (
          <>
            <p className="flex items-center justify-between font-semibold">
              {positionName(tyre.position)} <StatusBadge status={tyre.status} />
            </p>
            {tyre.latest ? (
              <p className="mt-1 text-navy-700">
                <Pressure kpa={tyre.latest.pressure_kpa} /> · {tyre.latest.temp_c.toFixed(0)} °C
              </p>
            ) : (
              <p className="mt-1 text-navy-700">No reading yet.</p>
            )}
          </>
        ) : (
          <p className="text-navy-700">Tap a tyre to see its pressure and temperature.</p>
        )}
      </div>
    </>
  )
}

function NextGarage({ truck }: { truck: TruckSummary }) {
  const { data, loading } = useApi(
    () => (truck.lat == null || truck.lon == null ? Promise.resolve([]) : getNearestGarages(truck.lat, truck.lon, 'tyre')),
    [truck.lat, truck.lon],
  )
  const g = data?.[0]
  return (
    <section id="next-garage" className="scroll-mt-20 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-green-500/15">
      <h2 className="inline-flex items-center gap-2 text-lg font-bold">
        <Wrench size={20} className="text-green-700" aria-hidden /> Next open garage
      </h2>
      {loading && !data && <p className="mt-2 text-sm text-navy-700">Finding garages…</p>}
      {data && !g && <p className="mt-2 text-sm text-navy-700">No open tyre garage found nearby.</p>}
      {g && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
            <p className="font-semibold">{g.name}</p>
            <p className="text-sm text-navy-700">
              <MapPin size={14} className="mr-1 inline" aria-hidden />
              {g.distance_km.toFixed(1)} km · {g.open_24x7 ? 'Open 24×7' : `Open till ${g.closes}`}
            </p>
          </div>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lon}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 font-semibold text-white hover:bg-green-500 sm:flex-none"
          >
            <Navigation size={18} aria-hidden /> Navigate
          </a>
          <a
            href={`tel:${g.phone.replace(/\s/g, '')}`}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-green-700 px-4 font-semibold text-green-700 hover:bg-green-50 sm:flex-none"
          >
            <Phone size={18} aria-hidden /> Call
          </a>
        </div>
      )}
    </section>
  )
}
