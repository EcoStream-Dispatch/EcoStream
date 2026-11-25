import { Link, NavLink, Outlet } from 'react-router-dom'
import { BarChart3, BellRing, BrainCircuit, CircleUserRound, LogOut, Package, Settings, Tag, Truck, Users, Wrench } from 'lucide-react'
import Wordmark from './Wordmark'
import { USING_MOCK_DATA } from '../services/api'
import { LiveProvider, useLiveStatus } from '../services/live'
import { useAuth } from '../auth/AuthProvider'
import { asset } from '../lib/asset'
import LanguageSwitch from './LanguageSwitch'
import { useLang } from '../lib/i18n'

/*
 * Shell for the owner pages (Fleet, Truck, Alerts).
 * Phones: logo bar on top, tab bar at the bottom (easy to reach with a thumb).
 * Wider screens: links move into the top bar.
 */
// `phone: false` = sidebar only; on phones it is reached from another page (Plans from Profile).
const NAV = [
  { to: '/fleet', label: 'nav.fleet' as const, icon: Truck, phone: true },
  { to: '/alerts', label: 'nav.alerts' as const, icon: BellRing, phone: true },
  { to: '/drivers', label: 'nav.drivers' as const, icon: Users, phone: true },
  { to: '/reports', label: 'nav.reports' as const, icon: BarChart3, phone: true },
  // From the team repo (Adithya): shipments, predictive, garages, settings
  { to: '/owner/shipments', label: 'nav.shipments' as const, icon: Package, phone: false },
  { to: '/owner/predictive', label: 'nav.predictive' as const, icon: BrainCircuit, phone: false },
  { to: '/owner/garages', label: 'nav.garages' as const, icon: Wrench, phone: false },
  { to: '/plans', label: 'nav.plans' as const, icon: Tag, phone: false },
  { to: '/owner/settings', label: 'nav.settings' as const, icon: Settings, phone: false },
  { to: '/profile', label: 'nav.profile' as const, icon: CircleUserRound, phone: true },
]
const PHONE_NAV = NAV.filter((n) => n.phone)

export default function AppLayout() {
  return (
    <LiveProvider>
      <Shell />
    </LiveProvider>
  )
}

/** Green dot = live updates connected. Not shown in demo mode. */
function LiveDot({ dark = false }: { dark?: boolean }) {
  const status = useLiveStatus()
  const { t } = useLang()
  if (status === 'off') return null
  const live = status === 'live'
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${dark ? 'text-white/80' : 'text-navy-700'}`}
      title={live ? 'Updates appear automatically' : 'Live updates not connected - data may be old'}
    >
      <span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse bg-green-500' : 'bg-gray-400'}`} aria-hidden />
      {live ? t('app.live') : status === 'error' ? 'Not live' : 'Connecting'}
    </span>
  )
}

function Shell() {
  const { session, signOut } = useAuth()
  const { t } = useLang()
  return (
    <div className="flex min-h-screen bg-green-50">
      {/* ---------- Sidebar (tablet / desktop) - layout from the Stitch owner portal ---------- */}
      <aside className="sticky top-0 hidden h-screen print:!hidden w-60 shrink-0 flex-col bg-navy-900 py-6 text-white md:flex">
        <Link to="/fleet" className="flex items-center gap-2 px-5" aria-label="EcoStream fleet">
          <img src={asset('logo-mark.png')} alt="" className="h-10 w-10 rounded-md bg-white object-contain p-0.5" />
          <span className="flex flex-col">
            <span className="font-heading text-base font-extrabold uppercase tracking-wide">
              <span className="text-green-300">Eco</span>stream
            </span>
            <span className="-mt-0.5 font-heading text-[9px] font-bold uppercase tracking-widest text-green-300/80">{t('app.ownerPortal')}</span>
          </span>
        </Link>
        <nav className="mt-10 flex-1 space-y-1" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 border-l-4 px-5 py-3 text-sm font-semibold transition ${
                  isActive ? 'border-green-300 bg-white/10 text-white' : 'border-transparent text-white/70 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon size={20} aria-hidden /> {t(label)}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-3 border-t border-white/10 px-5 pt-5">
          <LiveDot dark />
          {session && (
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white"
              title={`Logged in as ${session.user.email ?? session.user.phone ?? ''}`}
            >
              <LogOut size={18} aria-hidden /> {t('nav.logout')}
            </button>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ---------- Top bar ---------- */}
        <header className="sticky top-0 z-20 border-b print:hidden border-gray-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
            <Link to="/fleet" className="flex items-center gap-2 md:hidden" aria-label="EcoStream fleet">
              <img src={asset('logo-mark.png')} alt="" className="h-9 w-9 object-contain" />
              <Wordmark className="text-base" />
            </Link>
            <span className="hidden font-heading text-sm font-bold uppercase tracking-[0.2em] text-green-700 md:inline">
              Predict · Protect · Perform
            </span>
            <div className="flex items-center gap-3">
              <LanguageSwitch className="hidden lg:inline-flex" />
              <span className="md:hidden">
                <LiveDot />
              </span>
              {USING_MOCK_DATA && (
                <span
                  className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-warning/40"
                  title="This screen shows made-up data, not real trucks"
                >
                  {t('app.demoData')}
                </span>
              )}
              {session && (
                <button
                  onClick={signOut}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold text-navy-700 hover:bg-gray-100 md:hidden"
                  title="Log out"
                >
                  <LogOut size={18} aria-hidden />
                  <span className="hidden sm:inline">{t('nav.logout')}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Bottom padding leaves room for the phone tab bar */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 md:pb-10 md:pt-6">
          <Outlet />
        </main>
      </div>

      {/* ---------- Phone tab bar ---------- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex border-t print:hidden border-gray-200 bg-white md:hidden"
        aria-label="Main"
      >
        {PHONE_NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                isActive ? 'text-green-700' : 'text-navy-700'
              }`
            }
          >
            <Icon size={22} aria-hidden />
            {/* Tamil/Hindi words are long: keep each tab label inside its own tab */}
            <span className="block w-full truncate px-0.5 text-center text-[11px] leading-tight">{t(label)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
