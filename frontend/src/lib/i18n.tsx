import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/*
 * Very small translation helper for the language switch (English / Tamil / Hindi).
 *
 *   const { t, lang, setLang } = useLang()
 *   <h1>{t('login.title')}</h1>
 *
 * Only the public pages and the login use it for now. Missing keys fall back to English.
 * NOTE: the Tamil and Hindi text below is a first draft - a native speaker must review it
 * before real users see it.
 */
export type Lang = 'en' | 'ta' | 'hi'

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'hi', label: 'हिंदी' },
]

const en = {
  'nav.login': 'Login',
  'nav.home': 'Back to home',
  'hero.line': 'Know a tyre or engine problem before it stops your truck, and reach a verified garage, even at 2 a.m.',
  'hero.demo': 'Book a demo',
  'hero.how': 'How it works',
  'login.welcome': 'Log in to your EcoStream account',
  'login.role': 'I am a',
  'role.owner': 'Owner / Fleet manager',
  'role.driver': 'Driver',
  'role.shipper': 'Shipper',
  'role.soon': 'Coming later',
  'login.phone': 'Phone number',
  'login.otp': 'One-time password (OTP)',
  'login.otpHint': 'Enter the 6-digit code we sent by SMS',
  'login.sendOtp': 'Send OTP',
  'login.verify': 'Verify and log in',
  'login.resend': 'Resend OTP',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.submit': 'Log in',
  'login.busy': 'Please wait…',
  'login.usePhone': 'Use phone + OTP',
  'login.useEmail': 'Use email + password',
  'login.newOwner': 'New owner?',
  'login.noAccount': 'Ask EcoStream to set up your account.',
  'login.demoNote': "Login isn't connected yet, so this opens the demo with made-up data.",
  'login.openDemo': 'Open demo',
  'login.driverDemo': 'Open driver demo',
}
type Key = keyof typeof en

const ta: Partial<Record<Key, string>> = {
  'nav.login': 'உள்நுழை',
  'nav.home': 'முகப்புக்குத் திரும்பு',
  'hero.line': 'டயர் அல்லது இன்ஜின் பிரச்சனையை லாரி நிற்கும் முன்பே அறியுங்கள், இரவு 2 மணிக்கும் சரிபார்க்கப்பட்ட கேரேஜை அடையுங்கள்.',
  'hero.demo': 'டெமோ பதிவு செய்',
  'hero.how': 'எப்படி வேலை செய்கிறது',
  'login.welcome': 'உங்கள் EcoStream கணக்கில் உள்நுழையவும்',
  'login.role': 'நான்',
  'role.owner': 'உரிமையாளர் / ஃப்ளீட் மேலாளர்',
  'role.driver': 'ஓட்டுநர்',
  'role.shipper': 'சரக்கு அனுப்புநர்',
  'role.soon': 'விரைவில்',
  'login.phone': 'தொலைபேசி எண்',
  'login.otp': 'ஒருமுறை கடவுச்சொல் (OTP)',
  'login.otpHint': 'SMS மூலம் அனுப்பிய 6 இலக்க குறியீட்டை உள்ளிடவும்',
  'login.sendOtp': 'OTP அனுப்பு',
  'login.verify': 'சரிபார்த்து உள்நுழை',
  'login.resend': 'மீண்டும் OTP அனுப்பு',
  'login.email': 'மின்னஞ்சல்',
  'login.password': 'கடவுச்சொல்',
  'login.submit': 'உள்நுழை',
  'login.busy': 'காத்திருக்கவும்…',
  'login.usePhone': 'தொலைபேசி + OTP',
  'login.useEmail': 'மின்னஞ்சல் + கடவுச்சொல்',
  'login.newOwner': 'புதிய உரிமையாளரா?',
  'login.noAccount': 'உங்கள் கணக்கை அமைக்க EcoStream-ஐ கேளுங்கள்.',
  'login.demoNote': 'உள்நுழைவு இன்னும் இணைக்கப்படவில்லை, எனவே இது மாதிரி தரவுடன் டெமோவைத் திறக்கும்.',
  'login.openDemo': 'டெமோவைத் திற',
  'login.driverDemo': 'ஓட்டுநர் டெமோ',
}

const hi: Partial<Record<Key, string>> = {
  'nav.login': 'लॉग इन',
  'nav.home': 'होम पर वापस',
  'hero.line': 'टायर या इंजन की खराबी ट्रक रुकने से पहले जानें, और रात 2 बजे भी भरोसेमंद गैराज तक पहुँचें।',
  'hero.demo': 'डेमो बुक करें',
  'hero.how': 'यह कैसे काम करता है',
  'login.welcome': 'अपने EcoStream खाते में लॉग इन करें',
  'login.role': 'मैं हूँ',
  'role.owner': 'मालिक / फ्लीट मैनेजर',
  'role.driver': 'ड्राइवर',
  'role.shipper': 'शिपर',
  'role.soon': 'जल्द आ रहा है',
  'login.phone': 'फ़ोन नंबर',
  'login.otp': 'वन-टाइम पासवर्ड (OTP)',
  'login.otpHint': 'SMS से भेजा गया 6 अंकों का कोड डालें',
  'login.sendOtp': 'OTP भेजें',
  'login.verify': 'जाँचें और लॉग इन करें',
  'login.resend': 'OTP दोबारा भेजें',
  'login.email': 'ईमेल',
  'login.password': 'पासवर्ड',
  'login.submit': 'लॉग इन',
  'login.busy': 'कृपया रुकें…',
  'login.usePhone': 'फ़ोन + OTP',
  'login.useEmail': 'ईमेल + पासवर्ड',
  'login.newOwner': 'नए मालिक?',
  'login.noAccount': 'खाता बनाने के लिए EcoStream से कहें।',
  'login.demoNote': 'लॉग इन अभी जुड़ा नहीं है, इसलिए यह नमूना डेटा के साथ डेमो खोलेगा।',
  'login.openDemo': 'डेमो खोलें',
  'login.driverDemo': 'ड्राइवर डेमो',
}

const TABLES: Record<Lang, Partial<Record<Key, string>>> = { en, ta, hi }
const STORAGE_KEY = 'ecostream.lang'

interface LangState {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: Key) => string
}

const LangContext = createContext<LangState | null>(null)

function savedLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'ta' || v === 'hi') return v
  } catch {
    /* private mode: ignore */
  }
  return 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(savedLang)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  const t = (key: Key) => TABLES[lang][key] ?? en[key]
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
}

export function useLang(): LangState {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>')
  return ctx
}
