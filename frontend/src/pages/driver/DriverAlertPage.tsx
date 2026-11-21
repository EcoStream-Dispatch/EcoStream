import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, Moon, Navigation, OctagonAlert, Phone, Sun, Thermometer, Volume2, WifiOff, X, type LucideIcon } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { DEMO_OWNER_PHONE, getDriverGarages } from '../../services/api'
import { positionName } from '../../lib/tyreLayout'
import { ALERT_SENTENCE, SPEECH_LANG } from '../../i18n/alertSentences'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { AlertType } from '../../types'
import { useDriver } from './DriverLayout'

/*
 * Driver: full-screen alert (docs/WEBSITE_SPEC.md section 3.3).
 * One icon, one sentence in Tamil + English, big "Play voice" (browser text-to-speech,
 * Tamil when the phone has a Tamil voice), "Navigate to garage", "Call owner".
 * Dark navy version for night: on automatically from 7 pm to 6 am, or by the switch.
 */

const ICON: Record<AlertType, LucideIcon> = {
  slow_leak: AlertTriangle,
  low_pressure: AlertTriangle,
  critical_pressure: OctagonAlert,
  high_temp: Thermometer,
  sensor_offline: WifiOff,
}

const isNight = () => {
  const h = new Date().getHours()
  return h >= 19 || h < 6
}

/** Voices load late on Android Chrome: wait for them. */
function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])
  return voices
}

export default function DriverAlertPage() {
  const { id = '' } = useParams()
  const { t, lang } = useLanguage()
  const { home } = useDriver()
  const [night, setNight] = useState(isNight)
  const [note, setNote] = useState<string | null>(null)
  const voices = useVoices()
  const alert = home.openAlerts.find((a) => a.id === id)
  const truck = home.truck
  const garagesQ = useApi(() => (truck.lat != null && truck.lon != null ? getDriverGarages(truck.lat, truck.lon) : Promise.resolve([])), [truck])

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  if (!alert)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-xl font-bold">This alert is closed.</p>
        <Link to="/driver" className="rounded-xl bg-green-700 px-6 py-3 text-lg font-bold text-white">
          {t('driver.trip')}
        </Link>
      </div>
    )

  const Icon = ICON[alert.type]
  const tyre = truck.tyres.find((ty) => ty.id === alert.tyre_id)
  const critical = alert.severity === 'critical'
  const garage = garagesQ.data?.[0]
  // Show Tamil + English always, and Hindi too when the app is in Hindi.
  const lines: ('ta' | 'en' | 'hi')[] = lang === 'hi' ? ['hi', 'ta', 'en'] : ['ta', 'en']

  function play() {
    if (!('speechSynthesis' in window)) {
      setNote('This browser cannot speak. Please read the message.')
      return
    }
    const synth = window.speechSynthesis
    synth.cancel()
    const want: ('ta' | 'hi' | 'en')[] = lang === 'hi' ? ['hi', 'en'] : ['ta', 'en']
    const missing: string[] = []
    for (const l of want) {
      const voice = voices.find((v) => v.lang.toLowerCase().startsWith(l))
      if (!voice && l !== 'en') {
        missing.push(l === 'ta' ? 'Tamil' : 'Hindi')
        continue
      }
      const u = new SpeechSynthesisUtterance(ALERT_SENTENCE[l][alert!.type])
      u.lang = SPEECH_LANG[l]
      if (voice) u.voice = voice
      u.rate = 0.9
      synth.speak(u)
    }
    setNote(missing.length ? `${missing.join(' and ')} voice is not installed on this phone, so it plays in English.` : null)
  }

  const dark = night
  return (
    <div className={`flex min-h-screen flex-col ${dark ? 'bg-navy-900 text-white' : 'bg-white text-navy-900'}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setNight((n) => !n)}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ring-1 ${dark ? 'ring-white/30' : 'ring-gray-300'}`}
        >
          {dark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />} {dark ? t('driver.day') : t('driver.night')}
        </button>
        <Link to="/driver" className={`rounded-full p-2.5 ring-1 ${dark ? 'ring-white/30' : 'ring-gray-300'}`} aria-label="Close">
          <X size={24} aria-hidden />
        </Link>
      </div>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pb-6">
        <div className="flex flex-col items-center text-center">
          <span className={`flex h-28 w-28 items-center justify-center rounded-full ${critical ? 'bg-critical text-white' : 'bg-warning text-navy-900'}`}>
            <Icon size={64} strokeWidth={2.25} aria-hidden />
          </span>
          <p className={`mt-3 text-sm font-bold uppercase tracking-widest ${critical ? (dark ? 'text-red-300' : 'text-critical') : dark ? 'text-amber-300' : 'text-amber-800'}`}>
            {critical ? t('status.critical') : t('status.warning')}
            {tyre && ` · ${tyre.position} (${positionName(tyre.position)})`}
          </p>
        </div>

        <div className="mt-5 space-y-3 text-center">
          {lines.map((l, i) => (
            <p key={l} lang={l} className={i === 0 ? 'text-2xl font-bold leading-snug' : `text-xl leading-snug ${dark ? 'text-white/85' : 'text-navy-700'}`}>
              {ALERT_SENTENCE[l][alert.type]}
            </p>
          ))}
        </div>

        <div className="mt-auto space-y-3 pt-8">
          <button onClick={play} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-green-700 py-5 text-2xl font-bold text-white active:bg-green-500">
            <Volume2 size={30} aria-hidden /> {t('driver.playVoice')}
          </button>
          {note && (
            <p role="status" className={`text-center text-sm ${dark ? 'text-white/80' : 'text-navy-700'}`}>
              {note}
            </p>
          )}
          {garage ? (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${garage.lat},${garage.lon}`}
              target="_blank"
              rel="noreferrer"
              className={`flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-xl font-bold ring-2 ${dark ? 'bg-white text-navy-900 ring-white' : 'bg-white text-navy-900 ring-navy-900'}`}
            >
              <Navigation size={26} aria-hidden />
              <span className="text-left leading-tight">
                {t('driver.navigate')}
                <span className="block text-sm font-semibold">
                  {garage.name} · {garage.distance_km.toFixed(0)} km
                </span>
              </span>
            </a>
          ) : (
            <p className="text-center text-sm">Finding the nearest open garage…</p>
          )}
          <a
            href={`tel:${DEMO_OWNER_PHONE.replace(/\s/g, '')}`}
            className={`flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-xl font-bold ring-2 ${dark ? 'text-white ring-white/60' : 'text-green-700 ring-green-700'}`}
          >
            <Phone size={26} aria-hidden /> {t('driver.callOwner')}
          </a>
          <p className={`text-center text-xs ${dark ? 'text-white/60' : 'text-navy-700'}`}>Sample garage and owner number (demo).</p>
        </div>
      </main>
    </div>
  )
}
