import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import Header from '../components/Header'
import { useAuth } from '../auth/AuthProvider'

/**
 * Owner login (spec section 6.1): email + password through Supabase Auth.
 * Owners are created by hand in Supabase for now (docs/SUPABASE_SETUP.md step 3).
 */
export default function LoginPage() {
  const { session, demoMode, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const goTo = (location.state as { from?: string } | null)?.from ?? '/fleet'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session) return <Navigate to={goTo} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await signIn(email.trim(), password)
    setBusy(false)
    if (err) setError(err)
    else navigate(goTo, { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
        <h1 className="text-center text-2xl font-bold">Owner login</h1>

        {demoMode ? (
          <div className="mt-6 text-center">
            <p className="text-navy-700">Login isn't connected yet (no Supabase keys in .env).</p>
            <Link
              to="/fleet"
              className="mt-6 inline-block rounded-lg bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-500"
            >
              View demo dashboard
            </Link>
            <p className="mt-2 text-xs text-navy-700">Uses made-up data, not real trucks.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <label className="block">
              <span className="text-sm font-semibold">Email</span>
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
              <span className="text-sm font-semibold">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-300"
              />
            </label>
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critical">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !email || !password}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-3 font-semibold text-white transition hover:bg-green-500 disabled:opacity-50"
            >
              <LogIn size={18} aria-hidden /> {busy ? 'Logging in…' : 'Log in'}
            </button>
            <p className="text-center text-xs text-navy-700">No account? Ask EcoStream to set one up for you.</p>
          </form>
        )}

        <Link to="/" className="mt-8 text-center text-sm font-semibold text-green-700 hover:text-green-500">
          ← Back to home
        </Link>
      </main>
    </div>
  )
}
