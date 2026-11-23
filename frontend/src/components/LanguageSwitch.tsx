import { LANGS, useLang } from '../lib/i18n'

/** English / தமிழ் / हिंदी pill switch (from the Stitch "Sunlight" login). */
export default function LanguageSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang()
  return (
    <div
      role="group"
      aria-label="Language"
      className={`inline-flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-navy-900/10 ${className}`}
    >
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
          className={`min-h-[36px] rounded-full px-3 text-sm font-semibold transition ${
            lang === code ? 'bg-green-700 text-white' : 'text-navy-700 hover:bg-green-50'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
