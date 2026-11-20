import { Link } from 'react-router-dom'
import Header from '../components/Header'

/**
 * Placeholder. Real Supabase login (email + password) is built in Stage 6.
 * Until then, this links to the dashboard running on demo (mock) data.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Owner login</h1>
        <p className="mt-3 text-navy-700">Login is coming soon.</p>
        <Link
          to="/fleet"
          className="mt-6 rounded-lg bg-green-700 px-6 py-3 font-semibold text-white transition hover:bg-green-500"
        >
          View demo dashboard
        </Link>
        <p className="mt-2 text-xs text-navy-700">Uses made-up data, not real trucks.</p>
        <Link to="/" className="mt-6 font-semibold text-green-700 hover:text-green-500">
          ← Back to home
        </Link>
      </main>
    </div>
  )
}
