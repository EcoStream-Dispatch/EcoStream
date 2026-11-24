import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Cog, Download, Disc3, Fuel, Gauge, LogOut, Mountain, Navigation, Phone, Siren, Star, Thermometer, UserRound, Volume2, Wrench, X, type LucideIcon } from 'lucide-react'
import { getAlerts, getDrivers, getNearestGarages, getTrucks } from '../services/api'
import { useApi } from '../hooks/useApi'
import { LiveProvider, useLiveEvents, useThrottled } from '../services/live'
import { useAuth } from '../auth/AuthProvider'
import TyreLayout from '../components/TyreLayout'
import ParameterBoard from '../components/ParameterBoard'
import { PLAN_NAME, planOf } from '../lib/plans'
import FleetMap from '../components/FleetMap'
import StatusBadge from '../components/StatusBadge'
import Pressure from '../components/Pressure'
import Wordmark from '../components/Wordmark'
import { ErrorBox, Loading } from '../components/PageState'
import { ALERT_TITLE, STATUS_STYLE } from '../lib/status'
import { positionName } from '../lib/tyreLayout'
import { timeAgo } from '../lib/format'
import { asset } from '../lib/asset'
import { useLang, type Lang } from '../lib/i18n'
import LanguageSwitch from '../components/LanguageSwitch'
import { useInstallPrompt } from '../lib/install'
import { kpaToBar, kpaToPsi } from '../lib/units'
import { USING_MOCK_DATA } from '../services/api'
import { AVAILABILITY } from '../lib/drivers'
import { hoursUntilUnsafe } from '../lib/alerts'
import type { Alert, Driver, TruckSummary } from '../types'

/**
 * Driver "Live cockpit" (Stitch: Driver Portal, redrawn in the light brand; App Screens sheet:
 * "Live cockpit - tyre status, next garage"). One glance, one tap:
 *   - big alert banner when something is wrong (navy, readable at night), with
 *     Play voice / Navigate to garage
 *   - tyre layout, next open garage, map
 *   - 4 gauges (tyre pressure, hottest tyre, fuel, engine) and every driving data point
 *     for the truck's plan (ParameterBoard). Engine and fuel need the CAN plug-in (Pro).
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
  const { t } = useLang()
  const { canInstall, install } = useInstallPrompt()
  const trucksQ = useApi(getTrucks, [])
  const alertsQ = useApi(() => getAlerts(true), [])
  const refresh = useThrottled(() => {
    trucksQ.reload()
    alertsQ.reload()
  })
  useLiveEvents({ onReading: refresh, onAlert: refresh })

  const driversQ = useApi(getDrivers, [])

  // No driver accounts yet: the driver sees the first truck. In demo mode they can switch trucks.
  const [truckIdx, setTruckIdx] = useState(0)
  const truck = trucksQ.data?.[truckIdx] ?? trucksQ.data?.[0]
  const alert = (alertsQ.data ?? [])
    .filter((a) => a.truck_id === truck?.id)
    .sort(
      (a, b) =>
        RANK[b.severity] - RANK[a.severity] ||
        (hoursUntilUnsafe(a, truck) ?? Infinity) - (hoursUntilUnsafe(b, truck) ?? Infinity),
    )[0]
  const driver = driversQ.data?.find((d) => d.truck_id === truck?.id)

  // Full-screen alert: opens by itself for a critical alert the driver hasn't dismissed yet.
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed)
  const [preview, setPreview] = useState(false)
  const autoOpen = alert?.severity === 'critical' && !dismissed.includes(alert.id)
  const showOverlay = !!alert && !!truck && (autoOpen || preview)
  function closeOverlay() {
    if (alert) {
      const next = [...dismissed, alert.id]
      setDismissed(next)
      saveDismissed(next)
    }
    setPreview(false)
  }

  return (
    <div className="min-h-screen bg-green-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link to="/" className="flex items-center gap-2" aria-label="EcoStream home">
            <img src={asset('logo-mark.png')} alt="" className="h-9 w-9 object-contain" />
            <Wordmark className="text-base" />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitch className="[&>button]:min-h-[32px] [&>button]:px-2 [&>button]:text-xs sm:[&>button]:px-3 sm:[&>button]:text-sm" />
            {USING_MOCK_DATA && (
              <span className="hidden whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-warning/40 sm:inline">
                {t('drv.demoData')}
              </span>
            )}
            {session && (
              <button onClick={signOut} className="rounded-lg p-2 text-navy-700 hover:bg-gray-100" title={t('drv.logout')}>
                <LogOut size={20} aria-label={t('drv.logout')} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-4 px-4 pb-10 pt-4">
        {trucksQ.loading && !trucksQ.data && <Loading what="your truck" />}
        {trucksQ.error && <ErrorBox message={trucksQ.error} onRetry={trucksQ.reload} />}
        {trucksQ.data && !truck && <p className="text-navy-700">{t('drv.noTruck')}</p>}

        {truck && (
          <>
            {/* Command bar (Stitch v2): title, truck chips, live chip, SOS */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-md ring-1 ring-green-500/10">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-green-300">
                  <Gauge size={26} aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-extrabold md:text-2xl">{t('drv.title')}</h1>
                    <span className="rounded bg-gray-100 px-2 py-0.5 font-heading text-[11px] font-bold tracking-wider">{truck.reg_no}</span>
                  </div>
                  <p className="truncate text-sm text-navy-700">
                    {truck.make} {truck.model} · {t('drv.tyres', { n: truck.tyres.length })}
                  </p>
                  {USING_MOCK_DATA && (trucksQ.data?.length ?? 0) > 1 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Demo: pick a truck">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">{t('drv.demoSwitch')}</span>
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
                          {tk.reg_no} · {PLAN_NAME[planOf(tk)]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canInstall && (
                  <button
                    type="button"
                    onClick={install}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-green-700 ring-1 ring-green-500/40 hover:bg-green-50"
                  >
                    <Download size={18} aria-hidden /> {t('app.install')}
                  </button>
                )}
                <span className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-green-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" aria-hidden /> {t('drv.seen', { t: timeAgo(truck.last_seen_at) })}
                </span>
                <a
                  href="tel:112"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-critical px-4 font-semibold uppercase tracking-wider text-white shadow-md hover:bg-red-800"
                  title={t('drv.sosTitle')}
                >
                  <Siren size={18} aria-hidden /> SOS 112
                </a>
              </div>
            </div>

            {/* Navy banner: the one thing to do now, with voice */}
            {alert ? <AlertBanner alert={alert} truck={truck} onFullScreen={() => setPreview(true)} /> : <AllGood />}

            {/* Driver + route warnings */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DriverCard driver={driver} truck={truck} />
              <RouteWarnings />
            </div>

            {/* Sensor cards */}
            <SensorCards truck={truck} />

            {/* Every data point a driver needs, for this truck's plan */}
            <ParameterBoard truck={truck} role="driver" alerts={alertsQ.data ?? []} />

            {/* Map + garages */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="min-w-0 lg:col-span-8">
                <FleetMap trucks={[truck]} />
              </div>
              <div className="min-w-0 lg:col-span-4">
                <Garages truck={truck} />
              </div>
            </div>
          </>
        )}
      </main>
      {showOverlay && <AlertOverlay alert={alert!} truck={truck!} onClose={closeOverlay} />}
    </div>
  )
}

// ---------- Dismissed full-screen alerts (this browser tab only) ----------
const DISMISSED_KEY = 'ecostream.driver.dismissed'
function loadDismissed(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}
function saveDismissed(ids: string[]) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(ids))
  } catch {
    /* private mode: ignore */
  }
}

/**
 * What to tell the driver: English plus Tamil or Hindi (first drafts, need native review).
 * The chosen language is the big line; the other one sits under it. English screen: Tamil under it.
 */
function driverMessage(alert: Alert, truck: TruckSummary, lang: Lang) {
  const pos = truck.tyres.find((t) => t.id === alert.tyre_id)?.position
  const where = pos ? positionName(pos) : 'a tyre'
  const offline = alert.type === 'sensor_offline'
  const action =
    alert.severity === 'critical'
      ? 'Stop safely now.'
      : offline
        ? 'Check the tyre at your next stop.'
        : 'Drive slowly to the next garage.'
  const ta =
    alert.severity === 'critical'
      ? 'டயரில் பிரச்சனை. உடனே பாதுகாப்பாக நிறுத்துங்கள்.'
      : offline
        ? 'டயர் சென்சார் தகவல் வரவில்லை. அடுத்த நிறுத்தத்தில் டயரைச் சரிபாருங்கள்.'
        : 'டயரில் பிரச்சனை. மெதுவாக அடுத்த கேரேஜுக்குச் செல்லுங்கள்.'
  const hi =
    alert.severity === 'critical'
      ? 'टायर में समस्या। तुरंत सुरक्षित जगह रुकें।'
      : offline
        ? 'टायर सेंसर से जानकारी नहीं आ रही। अगले स्टॉप पर टायर जाँचें।'
        : 'टायर में समस्या। धीरे चलकर अगले गैराज तक जाएँ।'
  const en = `${ALERT_TITLE[alert.type]} on ${where}. ${action}`
  const localLang: 'ta' | 'hi' = lang === 'hi' ? 'hi' : 'ta'
  const local = localLang === 'hi' ? hi : ta
  return lang === 'en'
    ? { main: en, mainLang: 'en', sub: local, subLang: localLang, en, local, localLang }
    : { main: local, mainLang: localLang, sub: en, subLang: 'en', en, local, localLang }
}

/** Read the message aloud: Tamil or Hindi first, then English. */
function useVoice(en: string, local: string, localLang: 'ta' | 'hi') {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])
  function play() {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const ta1 = new SpeechSynthesisUtterance(local)
    ta1.lang = localLang === 'hi' ? 'hi-IN' : 'ta-IN'
    const en1 = new SpeechSynthesisUtterance(en)
    en1.lang = 'en-IN'
    en1.onend = () => setSpeaking(false)
    en1.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(ta1)
    window.speechSynthesis.speak(en1)
  }
  return { speaking, play, supported: typeof window !== 'undefined' && 'speechSynthesis' in window }
}

/** Full-screen alert (Stitch brief screen 8): one icon, one sentence, three big buttons. Navy for night use. */
function AlertOverlay({ alert, truck, onClose }: { alert: Alert; truck: TruckSummary; onClose: () => void }) {
  const { t, lang } = useLang()
  const m = driverMessage(alert, truck, lang)
  const { speaking, play } = useVoice(m.en, m.local, m.localLang)
  const { icon: Icon } = STATUS_STYLE[alert.severity]
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [])

  function toGarage() {
    onClose()
    setTimeout(() => document.getElementById('next-garage')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="overlay-title"
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-navy-900 px-5 py-8 text-white"
    >
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center text-center">
        <span
          className={`flex h-24 w-24 items-center justify-center rounded-full ${
            alert.severity === 'critical' ? 'animate-pulse bg-critical' : 'bg-warning text-navy-900'
          }`}
        >
          <Icon size={52} aria-hidden />
        </span>
        <p className="mt-4 font-heading text-sm font-bold uppercase tracking-widest text-white/70">{truck.reg_no}</p>
        <h1 id="overlay-title" lang={m.mainLang} className="mt-2 text-3xl font-extrabold leading-tight text-white">
          {m.main}
        </h1>
        <p lang={m.subLang} className="mt-3 text-xl text-white/85">
          {m.sub}
        </p>
        <div className="mt-8 grid w-full gap-3">
          <button
            type="button"
            onClick={play}
            className="inline-flex min-h-[60px] items-center justify-center gap-2 rounded-xl bg-white text-lg font-semibold text-navy-900 hover:bg-green-50"
          >
            <Volume2 size={24} aria-hidden /> {speaking ? t('drv.playing') : t('drv.play')}
          </button>
          <button
            type="button"
            onClick={toGarage}
            className="inline-flex min-h-[60px] items-center justify-center gap-2 rounded-xl bg-green-300 text-lg font-semibold text-navy-900 hover:bg-white"
          >
            <Navigation size={24} aria-hidden /> {t('drv.nearest')}
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[60px] items-center justify-center gap-2 rounded-xl border-2 border-white/40 text-lg font-semibold text-white hover:bg-white/10"
          >
            <X size={24} aria-hidden /> {t('drv.dismiss')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Who is driving. Ratings come with the Pro plan, so they say "coming soon". */
function DriverCard({ driver, truck }: { driver?: Driver; truck: TruckSummary }) {
  const { t } = useLang()
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-green-500/15">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy-900 text-green-300">
          <UserRound size={24} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-[11px] font-bold uppercase tracking-wider text-navy-700">{t('drv.driver')}</p>
          <p className="truncate text-lg font-bold">{driver ? driver.name : t('drv.notAssigned')}</p>
        </div>
        {driver && (
          <span className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${AVAILABILITY[driver.availability].cls}`}>
            {t(`drivers.${driver.availability}`)}
          </span>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-gray-50 p-2">
          <dt className="text-xs text-navy-700">{t('drv.truck')}</dt>
          <dd className="font-semibold">{truck.reg_no}</dd>
        </div>
        <div className="rounded-lg bg-gray-50 p-2">
          <dt className="text-xs text-navy-700">{t('drv.rating')}</dt>
          <dd className="flex items-center gap-1 font-semibold">
            <Star size={14} aria-hidden /> {driver?.rating != null ? `${driver.rating.toFixed(1)} / 5` : t('drv.ratingSoon')}
          </dd>
        </div>
      </dl>
    </section>
  )
}

/** Ghat / dead-zone warnings for the route. Nothing is mapped yet, so we say that. */
function RouteWarnings() {
  const { t } = useLang()
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-green-500/15">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
          <Mountain size={24} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-[11px] font-bold uppercase tracking-wider text-navy-700">{t('drv.ghatKicker')}</p>
          <p className="text-lg font-bold">{t('drv.ghatTitle')}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-navy-700">
        {t('drv.ghatBody')}
      </p>
    </section>
  )
}

function AllGood() {
  const { icon: Icon } = STATUS_STYLE.ok
  const { t } = useLang()
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-green-500/30">
      <Icon size={40} className="shrink-0 text-green-500" aria-hidden />
      <div>
        <p className="text-xl font-bold">{t('drv.allOk')}</p>
        <p className="text-sm text-navy-700">{t('drv.allOkBody')}</p>
      </div>
    </div>
  )
}

/** Big, plain alert for the driver. Navy so it's readable at night; Tamil line under English. */
function AlertBanner({ alert, truck, onFullScreen }: { alert: Alert; truck: TruckSummary; onFullScreen: () => void }) {
  const { t, lang } = useLang()
  const m = driverMessage(alert, truck, lang)
  const { speaking, play } = useVoice(m.en, m.local, m.localLang)
  const { icon: Icon } = STATUS_STYLE[alert.severity]

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
          <p lang={m.mainLang} className="text-xl font-bold leading-snug md:text-2xl">
            {m.main}
          </p>
          <p lang={m.subLang} className="mt-1 text-lg text-white/85">
            {m.sub}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={play}
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-white font-semibold text-navy-900 hover:bg-green-50"
        >
          <Volume2 size={20} aria-hidden /> {speaking ? t('drv.playing') : t('drv.play')}
        </button>
        <a
          href="#next-garage"
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-green-300 font-semibold text-navy-900 hover:bg-white"
        >
          <Navigation size={20} aria-hidden /> {t('drv.nearest')}
        </a>
        <span
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-white/30 font-semibold text-white/60"
          title={t('drv.callOwnerTitle')}
        >
          <Phone size={20} aria-hidden /> {t('drv.callOwner')}
        </span>
      </div>
      <button
        type="button"
        onClick={onFullScreen}
        className="mt-3 min-h-[44px] text-sm font-semibold text-white/80 underline underline-offset-2 hover:text-white"
      >
        {t('drv.fullScreen')}
      </button>
    </div>
  )
}

function TyreBoard({ truck }: { truck: TruckSummary }) {
  const { t } = useLang()
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
              <p className="mt-1 text-navy-700">{t('drv.noReading')}</p>
            )}
          </>
        ) : (
          <p className="text-navy-700">{t('drv.tapHint')}</p>
        )}
      </div>
    </>
  )
}

function Garages({ truck }: { truck: TruckSummary }) {
  const { t } = useLang()
  const { data, loading } = useApi(
    () => (truck.lat == null || truck.lon == null ? Promise.resolve([]) : getNearestGarages(truck.lat, truck.lon, 'tyre')),
    [truck.lat, truck.lon],
  )
  return (
    <section id="next-garage" className="h-full scroll-mt-20 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-green-500/15">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-lg font-bold">
          <Wrench size={20} className="text-green-700" aria-hidden /> {t('drv.garagesTitle')}
        </h2>
        {data && data.length > 0 && <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-bold">{t('drv.found', { n: data.length })}</span>}
      </div>
      <p className="mt-1 text-xs text-navy-700">{t('drv.straight')}</p>
      {loading && !data && <p className="mt-3 text-sm text-navy-700">{t('drv.finding')}</p>}
      {data && data.length === 0 && <p className="mt-3 text-sm text-navy-700">{t('drv.noGarage')}</p>}
      <ul className="mt-3 space-y-2">
        {(data ?? []).map((g, i) => (
          <li key={g.id} className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1 font-semibold">
                  <span className="truncate">{g.name}</span>
                  {g.verified && <BadgeCheck size={16} className="shrink-0 text-green-700" aria-label="Verified" />}
                </p>
                <p className="text-xs text-navy-700">{g.open_24x7 ? t('garage.open247') : t('garage.openTill', { t: g.closes ?? '' })}</p>
              </div>
              <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${i === 0 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-navy-700'}`}>
                {g.distance_km.toFixed(1)} km
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lon}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-lg bg-green-700 text-sm font-semibold text-white hover:bg-green-500"
              >
                <Navigation size={16} aria-hidden /> {t('garage.navigate')}
              </a>
              <a
                href={`tel:${g.phone.replace(/\s/g, '')}`}
                className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-lg border-2 border-green-700 text-sm font-semibold text-green-700 hover:bg-green-50"
              >
                <Phone size={16} aria-hidden /> {t('garage.call')}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Sensor cards row (Stitch v2 "bento"). Only tyre data is real in Phase 1; engine is shown locked. */
function SensorCards({ truck }: { truck: TruckSummary }) {
  const withData = truck.tyres.filter((t) => t.latest)
  const avgKpa = withData.length ? withData.reduce((n, t) => n + t.latest!.corrected_kpa, 0) / withData.length : null
  const hottest = withData.reduce<(typeof withData)[number] | null>((h, t) => (!h || t.latest!.temp_c > h.latest!.temp_c ? t : h), null)
  const okCount = truck.tyres.filter((t) => t.status === 'ok').length
  const allOk = okCount === truck.tyres.length
  const { t } = useLang()

  const params = truck.params ?? {}
  const fuel = params.fuel_level_probe ?? params.fuel_level_can
  const fault = params.fault_codes
  const coolant = params.coolant_temperature
  const tone = (st?: string) => (st === 'critical' ? 'text-critical' : st === 'warning' ? 'text-amber-800' : 'text-green-700')
  const needsPro = <p className="text-sm text-navy-700">{t('drv.needsPro')}</p>

  // The 4 cockpit gauges from the docs: tyre pressure, tyre heat, fuel, engine.
  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:col-span-2">
        <Card label="TPMS" title={t('drv.gTyrePressure')} icon={Disc3}>
          {avgKpa !== null ? (
            <>
              <Big value={kpaToPsi(avgKpa).toFixed(0)} unit="psi" />
              <p className={`mt-1 text-sm font-semibold ${allOk ? 'text-green-700' : 'text-amber-800'}`}>
                {allOk ? t('drv.allTyresOk', { n: truck.tyres.length }) : t('drv.needLook', { n: truck.tyres.length - okCount, m: truck.tyres.length })}
              </p>
              <p className="text-xs text-navy-700">{t('drv.avgNote', { bar: kpaToBar(avgKpa).toFixed(1) })}</p>
            </>
          ) : (
            <p className="text-sm text-navy-700">{t('drv.noReadings')}</p>
          )}
        </Card>
        <Card label="TPMS" title={t('drv.gHottest')} icon={Thermometer}>
          {hottest ? (
            <>
              <Big value={hottest.latest!.temp_c.toFixed(0)} unit="°C" />
              <p className={`mt-1 text-sm font-semibold ${hottest.latest!.temp_c > hottest.max_temp_c ? 'text-critical' : 'text-green-700'}`}>
                {positionName(hottest.position)}
              </p>
              <p className="text-xs text-navy-700">{t('drv.limit', { c: hottest.max_temp_c })}</p>
            </>
          ) : (
            <p className="text-sm text-navy-700">{t('drv.noReadings')}</p>
          )}
        </Card>
        <Card label={t('drv.gFuelLabel')} title={t('drv.gFuel')} icon={Fuel}>
          {fuel ? (
            <>
              <p className="font-heading text-2xl font-extrabold tracking-tight md:text-3xl">{fuel.text}</p>
              {fuel.note && <p className={`mt-1 text-sm font-semibold ${tone(fuel.status)}`}>{fuel.note}</p>}
            </>
          ) : (
            needsPro
          )}
        </Card>
        <Card label="CAN" title={t('drv.gEngine')} icon={Cog}>
          {fault || coolant ? (
            <>
              <p className={`font-heading text-lg font-extrabold leading-snug md:text-xl ${tone(fault?.status)}`}>{fault?.text ?? t('drv.noFaults')}</p>
              {coolant && <p className="mt-1 text-sm text-navy-700">{t('drv.coolant', { v: coolant.text })}</p>}
            </>
          ) : (
            needsPro
          )}
        </Card>
      </div>
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-green-500/10">
        <p className="font-heading text-[11px] font-bold uppercase tracking-wider text-navy-700">{t('drv.tapTyre')}</p>
        <TyreBoard truck={truck} />
      </div>
    </div>
  )
}

function Card({ label, title, icon: Icon, children }: { label: string; title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex h-full min-w-0 flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-green-500/10 md:p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-heading text-[11px] font-bold uppercase tracking-wider text-navy-700">{label}</p>
          <h3 className="text-base font-bold md:text-lg">{title}</h3>
        </div>
        <span className="shrink-0 rounded-lg bg-green-50 p-1.5 text-green-700">
          <Icon size={22} aria-hidden />
        </span>
      </div>
      <div>{children}</div>
    </div>
  )
}

function Big({ value, unit }: { value: string; unit: string }) {
  return (
    <p className="flex items-baseline gap-1">
      <span className="font-heading text-4xl font-extrabold tracking-tight">{value}</span>
      <span className="font-heading text-base font-semibold text-navy-700">{unit}</span>
    </p>
  )
}
