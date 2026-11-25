import { Link, useLocation } from 'react-router-dom'
import Wordmark from './Wordmark'
import { asset } from '../lib/asset'

/** Top bar for public pages: logo + brand name on the left, Login on the right. */
export default function Header() {
  const onLoginPage = useLocation().pathname === '/login'
  return (
    <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2" aria-label="EcoStream home">
          <img src={asset('logo-mark.png')} alt="" className="h-10 w-10 object-contain" />
          <Wordmark className="text-lg" />
        </Link>
        {!onLoginPage && (
        <Link
          to="/login"
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-300"
        >
          Login
        </Link>
        )}
      </div>
    </header>
  )
}
