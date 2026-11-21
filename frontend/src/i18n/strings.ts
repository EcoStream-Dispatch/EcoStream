/*
 * All words that change with the language switch (English / தமிழ் / हिंदी).
 *
 * - English is complete. Every key MUST exist in `en`.
 * - Tamil and Hindi cover navigation, login, alerts and status words for now.
 *   Any key missing there falls back to English automatically.
 * - TODO(human review): the Tamil and Hindi below are machine translations.
 *   A native speaker must check them before we show them to customers.
 *
 * To add text: add the key to `en` first, then (optionally) to `ta` and `hi`.
 */

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'hi', label: 'हिंदी' },
] as const

export type Lang = (typeof LANGUAGES)[number]['code']

export const en = {
  // Navigation (public site + owner app)
  'nav.home': 'Home',
  'nav.plans': 'Plans & pricing',
  'nav.garages': 'For garages',
  'nav.about': 'About & contact',
  'nav.login': 'Login',
  'nav.bookDemo': 'Book a demo',
  'nav.fleet': 'Fleet',
  'nav.alerts': 'Alerts',
  'nav.logout': 'Log out',
  'nav.menu': 'Menu',
  'nav.close': 'Close menu',
  'nav.language': 'Language',

  // Status words (always shown next to an icon, never colour alone)
  'status.ok': 'OK',
  'status.warning': 'Warning',
  'status.critical': 'Critical',
  'status.offline': 'Offline',

  // Login
  'login.title': 'Owner login',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.submit': 'Log in',
  'login.busy': 'Logging in…',
  'login.noAccount': 'No account? Ask EcoStream to set one up for you.',
  'login.back': '← Back to home',
  'login.demoNote': "Login isn't connected yet (no Supabase keys in .env).",
  'login.viewDemo': 'View demo dashboard',
  'login.demoMade': 'Uses made-up data, not real trucks.',

  // Alerts
  'alerts.title': 'Alerts',
  'alerts.open': 'Open',
  'alerts.closed': 'Closed',
  'alerts.acknowledge': 'Acknowledge',
  'alerts.garages': 'Nearest garages open now',
  'alerts.call': 'Call',

  // Shared
  'common.demoData': 'Demo data',
  'common.demoDataHint': 'This screen shows made-up data, not real trucks',
  'common.tagline': 'PREDICT · PROTECT · PERFORM',
  'footer.address': 'Address: coming soon (Chennai, Tamil Nadu)',
  'footer.prototype': 'Prototype. Sample data only.',
} as const

export type StringKey = keyof typeof en
type Dictionary = Partial<Record<StringKey, string>>

// TODO(human review): machine translation, check with a native Tamil speaker.
const ta: Dictionary = {
  'nav.home': 'முகப்பு',
  'nav.plans': 'திட்டங்கள் & விலை',
  'nav.garages': 'கேரேஜ்களுக்கு',
  'nav.about': 'எங்களைப் பற்றி & தொடர்பு',
  'nav.login': 'உள்நுழை',
  'nav.bookDemo': 'டெமோ முன்பதிவு',
  'nav.fleet': 'வாகனங்கள்',
  'nav.alerts': 'எச்சரிக்கைகள்',
  'nav.logout': 'வெளியேறு',
  'nav.menu': 'மெனு',
  'nav.close': 'மெனுவை மூடு',
  'nav.language': 'மொழி',
  'status.ok': 'சரி',
  'status.warning': 'எச்சரிக்கை',
  'status.critical': 'அபாயம்',
  'status.offline': 'இணைப்பில் இல்லை',
  'login.title': 'உரிமையாளர் உள்நுழைவு',
  'login.email': 'மின்னஞ்சல்',
  'login.password': 'கடவுச்சொல்',
  'login.submit': 'உள்நுழை',
  'login.busy': 'உள்நுழைகிறது…',
  'login.back': '← முகப்புக்குத் திரும்பு',
  'login.viewDemo': 'டெமோ டாஷ்போர்டைப் பார்',
  'alerts.title': 'எச்சரிக்கைகள்',
  'alerts.open': 'திறந்தவை',
  'alerts.closed': 'மூடியவை',
  'alerts.acknowledge': 'ஏற்றுக்கொள்',
  'alerts.garages': 'இப்போது திறந்திருக்கும் அருகிலுள்ள கேரேஜ்கள்',
  'alerts.call': 'அழை',
  'common.demoData': 'டெமோ தரவு',
}

// TODO(human review): machine translation, check with a native Hindi speaker.
const hi: Dictionary = {
  'nav.home': 'होम',
  'nav.plans': 'प्लान और कीमत',
  'nav.garages': 'गैराज के लिए',
  'nav.about': 'हमारे बारे में और संपर्क',
  'nav.login': 'लॉगिन',
  'nav.bookDemo': 'डेमो बुक करें',
  'nav.fleet': 'बेड़ा',
  'nav.alerts': 'अलर्ट',
  'nav.logout': 'लॉग आउट',
  'nav.menu': 'मेनू',
  'nav.close': 'मेनू बंद करें',
  'nav.language': 'भाषा',
  'status.ok': 'ठीक',
  'status.warning': 'चेतावनी',
  'status.critical': 'गंभीर',
  'status.offline': 'ऑफ़लाइन',
  'login.title': 'मालिक लॉगिन',
  'login.email': 'ईमेल',
  'login.password': 'पासवर्ड',
  'login.submit': 'लॉग इन करें',
  'login.busy': 'लॉग इन हो रहा है…',
  'login.back': '← होम पर वापस',
  'login.viewDemo': 'डेमो डैशबोर्ड देखें',
  'alerts.title': 'अलर्ट',
  'alerts.open': 'खुले',
  'alerts.closed': 'बंद',
  'alerts.acknowledge': 'स्वीकार करें',
  'alerts.garages': 'अभी खुले नज़दीकी गैराज',
  'alerts.call': 'कॉल करें',
  'common.demoData': 'डेमो डेटा',
}

export const DICTIONARIES: Record<Lang, Dictionary> = { en, ta, hi }
