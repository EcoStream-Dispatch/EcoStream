import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, MapPin, Phone, Siren } from 'lucide-react'
import { DEMO_OWNER_PHONE, sendSos } from '../../services/api'
import { placeName } from '../../lib/route'
import { useLanguage } from '../../i18n/LanguageProvider'
import { useDriver } from './DriverLayout'

/*
 * Driver: SOS (docs/WEBSITE_SPEC.md section 3.4). One big red button that alerts the
 * owner and emergency contacts with the location.
 *
 * Press and HOLD for 2 seconds (stops pocket / accidental presses). Works with touch,
 * mouse, and keyboard (hold Enter or Space). Location: the phone's GPS if allowed,
 * otherwise the truck's last position.
 *
 * Demo: nothing is really sent yet. "Call 112" is India's real emergency number.
 */

const HOLD_MS = 2000

export default function SosPage() {
  const { t } = useLanguage()
  const { home } = useDriver()
  const [progress, setProgress] = useState(0)
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [result, setResult] = useState<{ notified: string[]; where: string; source: string } | null>(null)
  const timer = useRef<number | null>(null)
  const started = useRef(0)

  const stop = () => {
    if (timer.current) cancelAnimationFrame(timer.current)
    timer.current = null
    if (state === 'idle') setProgress(0)
  }
  useEffect(() => () => stop(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    if (state !== 'idle' || timer.current) return
    started.current = performance.now()
    const tick = () => {
      const p = Math.min(1, (performance.now() - started.current) / HOLD_MS)
      setProgress(p)
      if (p >= 1) {
        timer.current = null
        void send()
      } else timer.current = requestAnimationFrame(tick)
    }
    timer.current = requestAnimationFrame(tick)
  }

  async function send() {
    setState('sending')
    const truckAt = home.truck.lat != null && home.truck.lon != null ? { lat: home.truck.lat, lon: home.truck.lon } : null
    const phoneAt = await new Promise<{ lat: number; lon: number } | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000, maximumAge: 60_000 },
      )
    })
    const at = phoneAt ?? truckAt ?? { lat: 0, lon: 0 }
    const r = await sendSos({ ...at, source: phoneAt ? 'phone' : 'truck' })
    setResult({
      notified: r.notified,
      where: phoneAt ? `${at.lat.toFixed(4)}, ${at.lon.toFixed(4)}` : truckAt ? placeName([at.lat, at.lon]) : 'unknown',
      source: phoneAt ? 'phone GPS' : "truck's last position",
    })
    setState('sent')
  }

  if (state === 'sent' && result)
    return (
      <div className="space-y-4">
        <div role="status" className="rounded-2xl bg-critical p-5 text-center text-white">
          <CheckCircle2 size={48} className="mx-auto" aria-hidden />
          <p className="mt-2 text-2xl font-bold">{t('driver.sosSent')}</p>
          <p className="mt-1 text-sm opacity-90">Demo: no message was really sent.</p>
        </div>
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="flex items-center gap-2 font-bold">
            <MapPin size={20} className="text-critical" aria-hidden /> {result.where}
          </p>
          <p className="text-sm text-navy-700">From the {result.source}</p>
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-navy-700">Alerted</p>
          <ul className="mt-1 space-y-1">
            {result.notified.map((n) => (
              <li key={n} className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-green-700" aria-hidden /> {n}
              </li>
            ))}
          </ul>
        </section>
        <CallButtons />
        <button
          onClick={() => {
            setState('idle')
            setProgress(0)
          }}
          className="w-full rounded-2xl py-3 text-lg font-bold text-navy-700 ring-1 ring-gray-300"
        >
          {t('driver.cancel')}
        </button>
      </div>
    )

  const deg = Math.round(progress * 360)
  return (
    <div className="flex flex-col items-center gap-6 pt-2">
      <h1 className="text-center text-xl font-bold">{t('driver.sosHold')}</h1>
      <button
        type="button"
        aria-label="SOS emergency. Press and hold for 2 seconds."
        disabled={state === 'sending'}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
            e.preventDefault()
            start()
          }
        }}
        onKeyUp={stop}
        onContextMenu={(e) => e.preventDefault()}
        className="relative flex h-64 w-64 touch-none select-none items-center justify-center rounded-full p-3 focus:outline-none focus-visible:ring-4 focus-visible:ring-navy-900"
        style={{ background: `conic-gradient(#0B1E36 ${deg}deg, #F4C7C7 ${deg}deg)` }}
      >
        <span className="flex h-full w-full flex-col items-center justify-center rounded-full bg-critical text-white shadow-lg active:scale-95">
          <Siren size={72} aria-hidden />
          <span className="mt-1 font-heading text-4xl font-extrabold">{state === 'sending' ? '…' : 'SOS'}</span>
        </span>
      </button>
      <p className="max-w-xs text-center text-navy-700">Your owner and emergency contacts get your location.</p>
      <div className="w-full">
        <CallButtons />
      </div>
    </div>
  )
}

function CallButtons() {
  const { t } = useLanguage()
  return (
    <div className="grid grid-cols-2 gap-3">
      <a href="tel:112" className="flex items-center justify-center gap-2 rounded-2xl bg-navy-900 py-4 text-lg font-bold text-white">
        <Phone size={22} aria-hidden /> Call 112
      </a>
      <a href={`tel:${DEMO_OWNER_PHONE.replace(/\s/g, '')}`} className="flex items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold text-green-700 ring-2 ring-green-700">
        <Phone size={22} aria-hidden /> {t('driver.callOwner')}
      </a>
    </div>
  )
}
