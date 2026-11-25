import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, BadgeCheck, KeyRound, Lock, Mail, Package, Repeat, Truck, UserRound, type LucideIcon } from 'lucide-react'
import Header from '../components/Header'
import LanguageSwitch from '../components/LanguageSwitch'
import Wordmark from '../components/Wordmark'
import { useAuth } from '../auth/AuthProvider'
import { useLang } from '../lib/i18n'
import { asset } from '../lib/asset'

/**
 * Login - Stitch "Direction A (Sunlight Clean)": light centred card, language switch,
 * role tabs (Owner / Driver / Shipper), email + password or phone + OTP.
 *
 * Email + password is what Supabase is set up for (spec section 6.1).
 * Phone + OTP works once an SMS provider is switched on in Supabase.
 * Shipper accounts are Phase 3: the Shipper tab opens a preview of the shipper view.
 */
type Role = 'owner' | 'driver' | 'shipper'
type Mode = 'email' | 'phone'

const ROLES: { id: Role; icon: LucideIcon; key: 'role.owner' | 'role.driver' | 'role.shipper'; enabled: boolean }[] = [
  { id: 'owner', icon: Truck, key: 'role.owner', enabled: true },
  { id: 'driver', icon: UserRound, key: 'role.driver', enabled: true },
  { id: 'shipper', icon: Package, key: 'role.shipper', enabled: true },
]

const HOME: Record<Role, string> = { owner: '/fleet', driver: '/driver', shipper: '/shipper' }

export default function LoginPage() {
  const { session, demoMode, signIn, sendOtp, verifyOtp } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const location = useLocation()

  const [role, setRole] = useState<Role>('owner')
  const [mode, setMode] = useState<Mode>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from
  const goTo = from ?? HOME[role]
  if (session) return <Navigate to={goTo} replace />

  const fullPhone = `+91${phone.replace(/\D/g, '')}`
  const phoneOk = /^\d{10}$/.test(phone.replace(/\D/g, ''))

  async function run(action: () => Promise<string | null>, onOk: () => void) {
    setBusy(true)
    setError(null)
    const err = await action()
    setBusy(false)
    if (err) setError(err)
    else onOk()
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'email') {
      run(() => signIn(email.trim(), password), () => navigate(goTo, { replace: true }))
    } else if (!otpSent) {
      run(() => sendOtp(fullPhone), () => setOtpSent(true))
    } else {
      run(() => verifyOtp(fullPhone, code.trim()), () => navigate(goTo, { replace: true }))
    }
  }

  const canSubmit =
    !busy && (mode === 'email' ? Boolean(email && password) : otpSent ? /^\d{6}$/.test(code) : phoneOk)

  return (
    <div className="flex min-h-screen flex-col bg-green-50">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 py-6 md:py-10">
        <div className="mb-6 flex w-full justify-end">
          <LanguageSwitch />
        </div>

        <div className="flex w-full max-w-md flex-col gap-6 rounded-xl bg-white p-6 shadow-xl ring-1 ring-navy-900/5 md:p-10">
          {/* Logo + brand */}
          <div className="flex flex-col items-center gap-2 text-center">
            <img src={asset('logo-mark.png')} alt="" className="h-16 w-16 object-contain" />
            <h1 className="text-3xl">
              <Wordmark />
            </h1>
            <p className="font-heading text-xs font-bold tracking-[0.2em] text-green-700">PREDICT · PROTECT · PERFORM</p>
            <p className="text-sm text-navy-700">{t('login.welcome')}</p>
          </div>

          {/* Role tabs */}
          <div role="tablist" aria-label={t('login.role')} className="grid grid-cols-3 gap-1 rounded-xl bg-green-50 p-1">
            {ROLES.map(({ id, icon: Icon, key, enabled }) => {
              const active = role === id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={!enabled}
                  onClick={() => setRole(id)}
                  title={enabled ? undefined : t('role.soon')}
                  className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-center text-xs font-semibold leading-tight transition ${
                    active
                      ? 'bg-white text-green-700 shadow-sm ring-1 ring-green-500/30'
                      : enabled
                        ? 'text-navy-700 hover:bg-white/70'
                        : 'cursor-not-allowed text-navy-700/50'
                  }`}
                >
                  <Icon size={20} aria-hidden />
                  <span>{t(key)}</span>
                  {!enabled && <span className="text-[10px] font-medium">{t('role.soon')}</span>}
                  {id === 'shipper' && <span className="text-[10px] font-medium text-navy-700/70">{t('role.preview')}</span>}
                </button>
              )
            })}
          </div>

          {demoMode ? (
            <div className="text-center">
              <p className="text-sm text-navy-700">{t('login.demoNote')}</p>
              <Link
                to={HOME[role]}
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-green-700 font-semibold text-white transition hover:bg-green-500"
              >
                {role === 'driver' ? t('login.driverDemo') : role === 'shipper' ? t('login.shipperDemo') : t('login.openDemo')} <ArrowRight size={18} aria-hidden />
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
              {mode === 'email' ? (
                <>
                  <Field label={t('login.email')} icon={Mail} htmlFor="email">
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@example.com"
                      className={INPUT}
                    />
                  </Field>
                  <Field label={t('login.password')} icon={KeyRound} htmlFor="password">
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={INPUT}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label={t('login.phone')} prefix="+91" htmlFor="phone">
                    <input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={11}
                      value={phone}
                      disabled={otpSent}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="98765 43210"
                      className={INPUT}
                    />
                  </Field>
                  {otpSent && (
                    <Field
                      label={t('login.otp')}
                      icon={Lock}
                      htmlFor="otp"
                      action={
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run(() => sendOtp(fullPhone), () => setCode(''))}
                          className="text-sm font-semibold text-green-700 hover:underline"
                        >
                          {t('login.resend')}
                        </button>
                      }
                    >
                      <input
                        id="otp"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••••"
                        aria-describedby="otp-hint"
                        className={`${INPUT} tracking-[0.4em]`}
                      />
                    </Field>
                  )}
                  {otpSent && (
                    <p id="otp-hint" className="-mt-3 text-xs text-navy-700">
                      {t('login.otpHint')}
                    </p>
                  )}
                </>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'email' ? 'phone' : 'email')
                    setOtpSent(false)
                    setError(null)
                  }}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:underline"
                >
                  <Repeat size={16} aria-hidden /> {mode === 'email' ? t('login.usePhone') : t('login.useEmail')}
                </button>
              </div>

              {error && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critical">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-green-700 font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:opacity-50"
              >
                {busy
                  ? t('login.busy')
                  : mode === 'email'
                    ? t('login.submit')
                    : otpSent
                      ? t('login.verify')
                      : t('login.sendOtp')}
                <ArrowRight size={18} aria-hidden />
              </button>
            </form>
          )}

          <p className="text-center text-sm text-navy-700">
            {t('login.newOwner')} <span className="font-semibold text-navy-900">{t('login.noAccount')}</span>
          </p>
        </div>

        <p className="mt-6 inline-flex items-center gap-1 text-xs text-navy-700">
          <BadgeCheck size={16} className="text-green-700" aria-hidden /> Each owner sees only their own trucks.
        </p>
        <Link to="/" className="mt-4 text-sm font-semibold text-green-700 hover:text-green-500">
          ← {t('nav.home')}
        </Link>
      </main>
    </div>
  )
}

const INPUT =
  'w-full bg-transparent px-3 py-3 text-base text-navy-900 placeholder:text-navy-700/50 focus:outline-none disabled:opacity-60'

/** Label + grey rounded input box with an icon or "+91" prefix (Stitch input style). */
function Field({
  label,
  htmlFor,
  icon: Icon,
  prefix,
  action,
  children,
}: {
  label: string
  htmlFor: string
  icon?: LucideIcon
  prefix?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-sm font-semibold">
          {label}
        </label>
        {action}
      </div>
      <div className="flex items-center overflow-hidden rounded-lg bg-gray-100 ring-1 ring-transparent transition focus-within:bg-white focus-within:ring-2 focus-within:ring-green-300">
        {prefix && <span className="self-stretch bg-gray-200 px-3.5 py-3 text-base text-navy-700">{prefix}</span>}
        {Icon && <Icon size={20} className="ml-3.5 shrink-0 text-navy-700" aria-hidden />}
        {children}
      </div>
    </div>
  )
}
