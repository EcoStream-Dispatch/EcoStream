import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import Wordmark from './Wordmark'
import { PUBLIC_NAV } from './Header'
import { useLanguage } from '../i18n/LanguageProvider'

/** Footer for public pages. No street address yet: it says "coming soon" on purpose. */
export default function Footer() {
  const { t } = useLanguage()
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3">
        <div>
          <Wordmark className="text-base" />
          <p className="mt-1 font-heading text-xs font-semibold tracking-[0.2em] text-green-700">{t('common.tagline')}</p>
          <p className="mt-3 text-sm text-navy-700">Predictive maintenance and smart dispatch for Indian trucks, starting with tyres.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="space-y-2 text-sm">
            {PUBLIC_NAV.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className="font-semibold text-navy-900 hover:text-green-700">
                  {t(label)}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/login" className="font-semibold text-navy-900 hover:text-green-700">
                {t('nav.login')}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="text-sm text-navy-700">
          <p className="flex items-start gap-2">
            <MapPin size={16} className="mt-0.5 shrink-0 text-green-700" aria-hidden />
            {t('footer.address')}
          </p>
          <p className="mt-4">
            © {new Date().getFullYear()} EcoStream. {t('footer.prototype')}
          </p>
        </div>
      </div>
    </footer>
  )
}
