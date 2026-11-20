import { Link, NavLink, Outlet } from 'react-router-dom'
import { BellRing, LogOut, Truck } from 'lucide-react'
import Wordmark from './Wordmark'
import { USING_MOCK_DATA } from '../services/api'
import { LiveProvider, useLiveStatus } from '../services/live'
import { useAuth } from '../auth/AuthProvider'
import { asset } from '../lib/asset'

/*
 * Shell for the owner pages (Fleet, Truck, Alerts).
 * Phones: logo bar on top, tab bar at the bottom (easy to reach with a thumb).
 * Wider screens: links move into the top bar.
 */
const NAV = [
  { to: '/fleet', label: 'Fleet', icon: Truck },
  { to: '/alerts', label: 'Alerts', icon: BellRing },
]

export default function AppLayout() {
  return (
    <LiveProvider>
      <Shell />
    </LiveProvider>
  )
}

/** Green dot = live updates connected. Not shown in demo mode. */
function LiveDot() {
  const status = useLiveStatus()
  if (status === 'off') return null
  const live = status === 'live'
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold text-navy-700"
      title={live ? 'Updates appear automatically' : 'Live updates not connected - data may be old'}
    >
      <span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse bg-green-500' : 'bg-gray-400'}`} aria-hidden />
      {live ? 'Live' : status === 'error' ? 'Not live' : 'Connecting'}
    </span>
  )
}

function Shell() {
  const { session, signOut } = useAuth()
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
          <Link to="/fleet" className="flex items-center gap-2" aria-label="EcoStream fleet">
            <img src={asset('logo-mark.png')} alt="" className="h-9 w-9 object-contain" />
            <Wordmark className="text-base" />
          </Link>
          <div className="flex items-center gap-3">
            <LiveDot />
            {USING_MOCK_DATA && (
              <span
                className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-warning/40"
                title="This screen shows made-up data, not real trucks"
              >
                Demo data
              </span>
            )}
            <nav className="hidden gap-1 md:flex" aria-label="Main">
              {NAV.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isActive ? 'bg-green-50 text-green-700' : 'text-navy-700 hover:bg-gray-100'
                    }`
                  }
                >
                  <Icon size={18} aria-hidden /> {label}
                </NavLink>
              ))}
            </nav>
            {session && (
              <button
                onClick={signOut}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold text-navy-700 hover:bg-gray-100"
                title={`Logged in as ${session.user.email ?? ''}`}
              >
                <LogOut size={18} aria-hidden />
                <span className="hidden sm:inline">Log out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Bottom padding leaves room for the phone tab bar */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-4 md:pb-10">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 border-t border-gray-200 bg-white md:hidden"
        aria-label="Main"
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-xs font-semibold ${
                isActive ? 'text-green-700' : 'text-navy-700'
              }`
            }
          >
            <Icon size={22} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
