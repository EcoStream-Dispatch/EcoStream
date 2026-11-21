import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import Wordmark from './Wordmark'
import LanguageSwitch from './LanguageSwitch'
import { asset } from '../lib/asset'
import { useAuth } from '../auth/AuthProvider'
import { useLanguage } from '../i18n/LanguageProvider'
import { USING_MOCK_DATA } from '../services/api'
import type { StringKey } from '../i18n/strings'

/**
 * Top bar + page area for the Driver and Shipper portals (stage W2).
 * Stages W5 / W6 add their own navigation inside.
 */
export default function PortalShell({ title, home, children }: { title: StringKey; home: string; children: ReactNode }) {
  const { session, signOut } = useAuth()
  const { t } = useLanguage()
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <Link to={home} className="flex min-w-0 items-center gap-2">
            <img src={asset('logo-mark.png')} alt="" className="h-9 w-9 shrink-0 object-contain" />
            <span className="hidden min-w-0 min-[420px]:block">
              <Wordmark className="block text-base" />
              <span className="block truncate text-xs font-semibold text-navy-700">{t(title)}</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            {USING_MOCK_DATA && (
              <span className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-warning/40">
                {t('common.demoData')}
              </span>
            )}
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold text-navy-700 hover:bg-gray-100"
              title={session?.user.email ? `${t('portal.signedInAs')} ${session.user.email}` : undefined}
            >
              <LogOut size={18} aria-hidden />
              <span className="hidden sm:inline">{t('nav.logout')}</span>
              <span className="sr-only sm:hidden">{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {/* Small phones: the portal name doesn't fit in the top bar, so show it here. */}
        <p className="mb-1 font-heading text-xs font-bold uppercase tracking-wide text-green-700 min-[420px]:hidden">{t(title)}</p>
        {children}
      </main>
    </div>
  )
}
