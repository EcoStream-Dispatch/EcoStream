import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Building2, Info, LogIn, Truck, UserRound, type LucideIcon } from 'lucide-react'
import Header from '../components/Header'
import { useAuth } from '../auth/AuthProvider'
import { PORTAL_HOME, ROLES, isRole, type Role } from '../auth/roles'
import { useLanguage } from '../i18n/LanguageProvider'
import type { StringKey } from '../i18n/strings'
import { primaryButton } from '../components/Form'

/**
 * One login page for everyone (docs/WEBSITE_SPEC.md public page 5, stage W2).
 * Pick a role -> email + password -> land on that role's portal.
 *
 * Why not phone + OTP yet: Supabase can only send OTP text messages once an SMS
 * provider (e.g. Twilio, MessageBird, Vonage, Textlocal) is connected, and that is
 * a paid account we don't have yet. Email + password works on the free plan.
 *
 * Demo mode (no Supabase keys): no password, the button opens that role's portal with sample data.
 */

const ROLE_CARD: Record<Role, { icon: LucideIcon; label: StringKey; hint: StringKey }> = {
  owner: { icon: Truck, label: 'role.owner', hint: 'role.ownerHint' },
  driver: { icon: UserRound, label: 'role.driver', hint: 'role.driverHint' },
  shipper: { icon: Building2, label: 'role.shipper', hint: 'role.shipperHint' },
}

export default function LoginPage() {
  const { role: currentRole, ready, demoMode, signIn, enterDemo } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const state = (useLocation().state as { from?: string; role?: string } | null) ?? {}

  // Start with the role of the page the visitor tried to open, else Owner.
  const [role, setRole] = useState<Role>(isRole(state.role) ? state.role : 'owner')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only go back to the page they came from if it belongs to the role they logged in as.
  const goTo = (r: Role) => (state.from && state.role === r ? state.from : PORTAL_HOME[r])

  if (ready && currentRole && !busy) return <Navigate to={goTo(currentRole)} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (demoMode) {
      enterDemo(role)
      navigate(goTo(role), { replace: true })
      return
    }
    setBusy(true)
    setError(null)
    const err = await signIn(email.trim(), password, role)
    setBusy(false)
    if (err) setError(err)
    else navigate(goTo(role), { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <h1 className="text-center text-2xl font-bold">{t('login.title')}</h1>

        <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
          {/* Role selector */}
          <fieldset>
            <legend className="text-sm font-semibold">{t('login.chooseRole')}</legend>
            <div className="mt-2 grid gap-2">
              {ROLES.map((r) => {
                const { icon: Icon, label, hint } = ROLE_CARD[r]
                const selected = role === r
                return (
                  <label
                    key={r}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition ${
                      selected ? 'border-green-700 bg-green-50' : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={selected}
                      onChange={() => {
                        setRole(r)
                        setError(null)
                      }}
                      className="h-5 w-5 shrink-0 accent-green-700"
                    />
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        selected ? 'bg-green-700 text-white' : 'bg-navy-900 text-white'
                      }`}
                    >
                      <Icon size={20} aria-hidden />
                    </span>
                    <span>
                      <span className="block font-semibold">{t(label)}</span>
                      <span className="block text-xs text-navy-700">{t(hint)}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {demoMode ? (
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-warning/40">
              <p className="flex items-start gap-2">
                <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
                {t('login.demoNote')}
              </p>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="text-sm font-semibold">{t('login.email')}</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-300"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">{t('login.password')}</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-300"
                />
              </label>
              <p className="text-xs text-navy-700">{t('login.phoneSoon')}</p>
            </>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critical">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || (!demoMode && (!email || !password))}
            className={`${primaryButton} w-full`}
          >
            <LogIn size={18} aria-hidden />
            {demoMode ? t('login.viewDemo') : busy ? t('login.busy') : t('login.submit')}
          </button>

          {!demoMode && <p className="text-center text-xs text-navy-700">{t('login.noAccount')}</p>}
        </form>

        <p className="mt-6 text-center text-sm text-navy-700">
          {t('login.newOwner')}{' '}
          <Link to="/about?topic=demo#contact" className="font-semibold text-green-700 hover:text-green-500">
            {t('nav.bookDemo')}
          </Link>
        </p>
        <Link to="/" className="mt-4 text-center text-sm font-semibold text-green-700 hover:text-green-500">
          {t('login.back')}
        </Link>
      </main>
    </div>
  )
}
