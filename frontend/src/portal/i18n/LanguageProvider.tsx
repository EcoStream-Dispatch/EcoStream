import { useCallback, type ReactNode } from 'react'
import { useLang } from '../../lib/i18n'
import { DICTIONARIES, en, type Lang, type StringKey } from './strings'

/*
 * Language for Adithya's pages. The language choice is the app's one switch (src/lib/i18n);
 * the words come from his dictionaries (./strings), so his translations are kept.
 *   const { t, lang, setLang } = useLanguage()
 */
type LanguageContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: StringKey) => string
}

/** Kept so existing imports still work; the app's LanguageProvider (main.tsx) does the job. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useLanguage(): LanguageContextValue {
  const { lang, setLang } = useLang()
  const t = useCallback((key: StringKey) => DICTIONARIES[lang][key] ?? en[key], [lang])
  return { lang, setLang, t }
}
