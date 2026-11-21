import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DICTIONARIES, en, type Lang, type StringKey } from './strings'

/*
 * Language switch.
 *   const { t, lang, setLang } = useLanguage()
 *   t('nav.login')  ->  "Login" / "உள்நுழை" / "लॉगिन"
 * Missing Tamil/Hindi words fall back to English.
 * The choice is remembered in this browser (localStorage) when possible.
 */

const STORAGE_KEY = 'ecostream.lang'

type LanguageContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: StringKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function savedLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'ta' || v === 'hi') return v
  } catch {
    // private window / storage blocked: just use English
  }
  return 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(savedLang)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore: the switch still works for this visit
    }
  }, [])

  // Tell the browser (and screen readers) which language the page is in.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback((key: StringKey) => DICTIONARIES[lang][key] ?? en[key], [lang])

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return ctx
}
