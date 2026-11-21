import { Languages } from 'lucide-react'
import { LANGUAGES, type Lang } from '../i18n/strings'
import { useLanguage } from '../i18n/LanguageProvider'

/** Small dropdown: English / தமிழ் / हिंदी. Used in every header. */
export default function LanguageSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useLanguage()
  return (
    <label className={`inline-flex items-center gap-1 text-sm text-navy-700 ${className}`}>
      <Languages size={18} aria-hidden />
      <span className="sr-only">{t('nav.language')}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className="rounded-md border border-gray-200 bg-white py-1 pl-1 pr-6 text-sm font-semibold text-navy-900 focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-300"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  )
}
