import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  Bell,
  BellRing,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  Package,
  Search,
  Settings,
  Truck,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import Wordmark from './Wordmark'
import LanguageSwitch from './LanguageSwitch'
import { USING_MOCK_DATA, getAlerts, getShipments, getTrucks } from '../services/api'
import { LiveProvider, useLiveEvents, useLiveStatus, useThrottled } from '../services/live'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../auth/AuthProvider'
import { asset } from '../lib/asset'
import { useLanguage } from '../i18n/LanguageProvider'
import type { StringKey } from '../i18n/strings'

/*
 * Owner / fleet-manager portal shell (docs/WEBSITE_SPEC.md section 2, stage W3).
 *   Wide screens: navy sidebar on the left, top bar with search, language, bell, profile.
 *   Phones: top bar + bottom tab bar (Dashboard, Map, Trucks, Alerts, More).
 *           "More" opens the full sidebar as a drawer.
 */

type NavItem = { to: string; label: StringKey; icon: LucideIcon; soon?: boolean }

export const OWNER_NAV: NavItem[] = [
  { to: '/owner/dashboard', label: 'owner.dashboard', icon: LayoutDashboard },
  { to: '/owner/map', label: 'owner.map', icon: MapIcon },
  { to: '/owner/trucks', label: 'owner.trucks', icon: Truck },
  { to: '/owner/predictive', label: 'owner.predictive', icon: Activity, soon: true },
  { to: '/owner/alerts', label: 'owner.alerts', icon: BellRing },
  { to: '/owner/shipments', label: 'owner.shipments', icon: Package, soon: true },
  { to: '/owner/drivers', label: 'owner.drivers', icon: Users, soon: true },
  { to: '/owner/garages', label: 'owner.garages', icon: Wrench, soon: true },
  { to: '/owner/reports', label: 'owner.reports', icon: BarChart3, soon: true },
  { to: '/owner/plan', label: 'owner.plan', icon: CreditCard, soon: true },
  { to: '/owner/settings', label: 'owner.settings', icon: Settings, soon: true },
]

const PHONE_TABS = OWNER_NAV.filter((n) => ['/owner/dashboard', '/owner/map', '/owner/trucks', '/owner/alerts'].includes(n.to))

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
      <span className="hidden sm:inline">{live ? 'Live' : status === 'error' ? 'Not live' : 'Connecting'}</span>
    </span>
  )
}

function Shell() {
  const { pathname } = useLocation()
  const { t } = useLanguage()
  const [drawer, setDrawer] = useState(false)
  useEffect(() => setDrawer(false), [pathname])

  return (
    <div className="min-h-screen bg-gray-50 lg:pl-64">
      {/* Sidebar: fixed on wide screens, a drawer on phones */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-navy-900 text-white transition-transform lg:translate-x-0 ${
          drawer ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Owner menu"
      >
        <Sidebar onClose={() => setDrawer(false)} />
      </aside>
      {drawer && (
        <button className="fixed inset-0 z-30 bg-navy-900/40 lg:hidden" aria-label={t('nav.close')} onClick={() => setDrawer(false)} />
      )}

      <TopBar onMenu={() => setDrawer(true)} />

      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4 lg:px-6 lg:pb-10">
        <Outlet />
      </main>

      {/* Phone tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-gray-200 bg-white lg:hidden" aria-label="Main">
        {PHONE_TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex min-w-0 flex-col items-center gap-0.5 px-1 py-2 text-xs font-semibold ${isActive ? 'text-green-700' : 'text-navy-700'}`
            }
          >
            <Icon size={22} aria-hidden />
            <span className="max-w-full truncate">{t(label)}</span>
          </NavLink>
        ))}
        <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-0.5 py-2 text-xs font-semibold text-navy-700">
          <Menu size={22} aria-hidden />
          {t('owner.more')}
        </button>
      </nav>
    </div>
  )
}

function Sidebar({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage()
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-4">
        <Link to="/owner/dashboard" className="flex items-center gap-2" aria-label="EcoStream dashboard">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
            <img src={asset('logo-mark.png')} alt="" className="h-8 w-8 object-contain" />
          </span>
          <span className="font-heading text-lg font-extrabold uppercase tracking-wide">
            <span className="text-green-300">Eco</span>stream
          </span>
        </Link>
        <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10 lg:hidden" aria-label={t('nav.close')}>
          <X size={20} aria-hidden />
        </button>
      </div>
      <div className="px-3 pb-3 md:hidden">
        <SearchBox dark />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Owner sections">
        <ul className="space-y-0.5">
          {OWNER_NAV.map(({ to, label, icon: Icon, soon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    isActive ? 'bg-green-700 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon size={18} aria-hidden />
                <span className="flex-1">{t(label)}</span>
                {soon && (
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/70">{t('owner.soon')}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <p className="px-4 pb-4 font-heading text-[10px] font-semibold tracking-[0.2em] text-green-300">{t('common.tagline')}</p>
    </div>
  )
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { session, signOut } = useAuth()
  const { t } = useLanguage()
  const alertsQ = useApi(() => getAlerts(true), [])
  const refresh = useThrottled(alertsQ.reload, 2000)
  useLiveEvents({ onAlert: refresh })
  const openCount = alertsQ.data?.length ?? 0
  const who = session?.user.email ?? 'Demo owner'

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-4 py-2 lg:px-6">
        <button onClick={onMenu} className="-ml-1 rounded-lg p-2 text-navy-900 hover:bg-gray-100 lg:hidden" aria-label={t('nav.menu')}>
          <Menu size={22} aria-hidden />
        </button>
        <Link to="/owner/dashboard" className="flex items-center gap-2 lg:hidden" aria-label="EcoStream dashboard">
          <img src={asset('logo-mark.png')} alt="" className="h-8 w-8 object-contain" />
          <Wordmark className="hidden text-base min-[480px]:inline" />
        </Link>

        <div className="hidden max-w-md flex-1 md:block">
          <SearchBox />
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
          <LiveDot />
          {USING_MOCK_DATA && (
            <span
              className="hidden whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-warning/40 min-[400px]:inline"
              title={t('common.demoDataHint')}
            >
              {t('common.demoData')}
            </span>
          )}
          <LanguageSwitch />
          <Link
            to="/owner/alerts"
            className="relative rounded-lg p-2 text-navy-900 hover:bg-gray-100"
            aria-label={`${t('owner.notifications')}: ${openCount}`}
            title={t('owner.notifications')}
          >
            <Bell size={20} aria-hidden />
            {openCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-critical px-1 text-[11px] font-bold text-white">
                {openCount}
              </span>
            )}
          </Link>
          <span
            className="hidden h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-sm font-bold uppercase text-white sm:flex"
            title={who}
            aria-hidden
          >
            {who.charAt(0)}
          </span>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1 rounded-lg p-2 text-sm font-semibold text-navy-700 hover:bg-gray-100"
            title={`${t('portal.signedInAs')} ${who}`}
          >
            <LogOut size={18} aria-hidden />
            <span className="hidden xl:inline">{t('nav.logout')}</span>
            <span className="sr-only xl:hidden">{t('nav.logout')}</span>
          </button>
        </div>
      </div>
    </header>
  )
}

/**
 * Search by truck number ("0004" or "TN 99 ZZ 0004") or shipment ID ("SHP-1002").
 * Suggestions come from the owner's trucks and shipments.
 */
function SearchBox({ dark = false }: { dark?: boolean }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const trucksQ = useApi(getTrucks, [])
  const shipmentsQ = useApi(() => (trucksQ.data ? getShipments(trucksQ.data) : Promise.resolve([])), [trucksQ.data])
  const [q, setQ] = useState('')
  const [notFound, setNotFound] = useState(false)
  const listId = dark ? 'owner-search-drawer' : 'owner-search'

  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const options = [
    ...(trucksQ.data ?? []).map((tr) => ({ label: tr.reg_no, to: `/owner/trucks/${tr.id}` })),
    ...(shipmentsQ.data ?? []).map((s) => ({ label: s.id, to: `/owner/shipments/${s.id}` })),
  ]

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const n = norm(q)
    if (!n) return
    const hit = options.find((o) => norm(o.label) === n) ?? options.find((o) => norm(o.label).includes(n))
    if (hit) {
      navigate(hit.to)
      setQ('')
      setNotFound(false)
    } else setNotFound(true)
  }

  return (
    <form onSubmit={onSubmit} role="search" className="relative">
      <Search
        size={16}
        className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-white/60' : 'text-navy-700'}`}
        aria-hidden
      />
      <input
        type="search"
        list={listId}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setNotFound(false)
        }}
        placeholder={t('owner.search')}
        aria-label={t('owner.search')}
        aria-invalid={notFound}
        className={`w-full rounded-lg py-2 pl-9 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-green-300 sm:text-sm ${
          dark ? 'border border-white/20 bg-white/10 text-white placeholder:text-white/60' : 'border border-gray-200 bg-gray-50 text-navy-900'
        }`}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.to} value={o.label} />
        ))}
      </datalist>
      {notFound && (
        <p role="alert" className="absolute left-0 top-full z-10 mt-1 rounded bg-white px-2 py-1 text-xs text-critical shadow ring-1 ring-gray-200">
          No truck or shipment matches “{q}”.
        </p>
      )}
    </form>
  )
}
