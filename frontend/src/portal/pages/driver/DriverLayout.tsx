import { createContext, useContext, type ReactNode } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { AlertTriangle, ChevronRight, Gauge, History, LogOut, Navigation, OctagonAlert, Siren, type LucideIcon } from 'lucide-react'
import LanguageSwitch from '../../components/LanguageSwitch'
import { asset } from '../../lib/asset'
import { useAuth } from '../../auth/AuthProvider'
import { useApi } from '../../hooks/useApi'
import { getDriverHome, worstAlertForDriver, type DriverHome } from '../../services/api'
import { ALERT_TITLE } from '../../lib/status'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { StringKey } from '../../i18n/strings'
import { ErrorBox, Loading } from '../../components/PageState'

/*
 * Driver portal shell (docs/WEBSITE_SPEC.md section 3, stage W5).
 * Made for a cheap Android phone held in a truck cab: large text, big buttons,
 * a bottom tab bar (Trip, Truck, SOS, My trips), and a big alert banner at the top
 * whenever the truck has an open alert.
 * Data is sample data for now (see getDriverHome in src/services/api.ts).
 */

type Ctx = { home: DriverHome; reload: () => void }
const DriverContext = createContext<Ctx | null>(null)

export function useDriver(): Ctx {
  const ctx = useContext(DriverContext)
  if (!ctx) throw new Error('useDriver must be used inside the driver portal')
  return ctx
}

/** Loads the driver's home data once for all driver pages. */
export function DriverDataProvider({ children }: { children: ReactNode }) {
  const q = useApi(getDriverHome, [])
  if (q.loading && !q.data) return <Loading what="your trip" />
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />
  return <DriverContext.Provider value={{ home: q.data!, reload: q.reload }}>{children}</DriverContext.Provider>
}

const TABS: { to: string; label: StringKey; icon: LucideIcon; sos?: boolean }[] = [
  // In the merged app, /driver is the live cockpit; Adithya's "My trip" lives at /driver/trip.
  { to: '/driver/trip', label: 'driver.trip', icon: Navigation },
  { to: '/driver', label: 'driver.truck', icon: Gauge },
  { to: '/driver/sos', label: 'driver.sos', icon: Siren, sos: true },
  { to: '/driver/history', label: 'driver.history', icon: History },
]

export default function DriverLayout() {
  const { signOut } = useAuth()
  const { t } = useLanguage()
  const { home } = useDriver()
  const worst = worstAlertForDriver(home.openAlerts)

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-2">
          <Link to="/driver/trip" className="flex min-w-0 items-center gap-2">
            <img src={asset('logo-mark.png')} alt="" className="h-9 w-9 shrink-0 object-contain" />
            <span className="min-w-0">
              <span className="block whitespace-nowrap font-heading text-base font-bold">{home.truck.reg_no}</span>
              <span className="block truncate text-xs text-navy-700">{home.driver.name}</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitch compact />
            <button onClick={signOut} className="rounded-lg p-2.5 text-navy-700 hover:bg-gray-100" aria-label={t('nav.logout')} title={t('nav.logout')}>
              <LogOut size={20} aria-hidden />
            </button>
          </div>
        </div>
        {worst && (
          <Link
            to={`/driver/alert/${worst.id}`}
            className={`flex items-center gap-3 px-4 py-3 text-white ${worst.severity === 'critical' ? 'bg-critical' : 'bg-amber-700'}`}
          >
            {worst.severity === 'critical' ? <OctagonAlert size={26} aria-hidden /> : <AlertTriangle size={26} aria-hidden />}
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold uppercase tracking-wide opacity-90">{t('driver.alertNow')}</span>
              <span className="block truncate text-lg font-bold">{ALERT_TITLE[worst.type]}</span>
            </span>
            <ChevronRight size={24} aria-hidden />
          </Link>
        )}
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-4">
        <p className="mb-3 text-xs text-navy-700">
          <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 ring-1 ring-warning/40">{t('common.demoData')}</span>{' '}
          Sample trip and truck.
        </p>
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white" aria-label="Driver">
        <div className="mx-auto grid max-w-xl grid-cols-4">
          {TABS.map(({ to, label, icon: Icon, sos }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-sm font-bold ${
                  sos ? 'text-critical' : isActive ? 'text-green-700' : 'text-navy-700'
                } ${isActive ? 'bg-green-50' : ''}`
              }
            >
              {sos ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-critical text-white">
                  <Icon size={20} aria-hidden />
                </span>
              ) : (
                <Icon size={28} aria-hidden />
              )}
              {t(label)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
