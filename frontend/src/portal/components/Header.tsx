import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Wordmark from './Wordmark'
import LanguageSwitch from './LanguageSwitch'
import { asset } from '../lib/asset'
import { useLanguage } from '../i18n/LanguageProvider'
import type { StringKey } from '../i18n/strings'

/** Public site links (shown in the header and footer). */
export const PUBLIC_NAV: { to: string; label: StringKey }[] = [
  { to: '/', label: 'nav.home' },
  { to: '/plans', label: 'nav.plans' },
  { to: '/garages/join', label: 'nav.garages' },
  { to: '/about', label: 'nav.about' },
]

/**
 * Top bar for public pages.
 * Wide screens: logo, links, language, Login.
 * Phones: logo, language, Login, and a menu button that opens the links.
 */
export default function Header() {
  const { pathname } = useLocation()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const onLoginPage = pathname === '/login'

  // Close the phone menu after moving to another page.
  useEffect(() => setOpen(false), [pathname])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold transition ${
      isActive ? 'text-green-700' : 'text-navy-900 hover:bg-green-50'
    }`

  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="EcoStream home">
          <img src={asset('logo-mark.png')} alt="" className="h-10 w-10 object-contain" />
          <Wordmark className="hidden text-lg min-[400px]:inline" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {PUBLIC_NAV.map(({ to, label }) => (
            <NavLink key={to} to={to} end className={linkClass}>
              {t(label)}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitch />
          {!onLoginPage && (
            <Link
              to="/login"
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-300"
            >
              {t('nav.login')}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="public-menu"
            className="rounded-lg p-2 text-navy-900 hover:bg-green-50 lg:hidden"
          >
            {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
            <span className="sr-only">{open ? t('nav.close') : t('nav.menu')}</span>
          </button>
        </div>
      </div>

      {open && (
        <nav id="public-menu" className="border-t border-gray-100 bg-white px-4 py-2 lg:hidden" aria-label="Main">
          {PUBLIC_NAV.map(({ to, label }) => (
            <NavLink key={to} to={to} end className={({ isActive }) => `block ${linkClass({ isActive })} py-3`}>
              {t(label)}
            </NavLink>
          ))}
          <Link to="/about?topic=demo#contact" className="block rounded-lg px-3 py-3 text-sm font-semibold text-green-700">
            {t('nav.bookDemo')}
          </Link>
        </nav>
      )}
    </header>
  )
}
