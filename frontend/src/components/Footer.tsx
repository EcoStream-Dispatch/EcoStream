import { Link } from 'react-router-dom'
import Wordmark from './Wordmark'

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <Wordmark className="text-base" />
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm font-semibold text-navy-700" aria-label="Footer">
          <Link to="/about" className="hover:text-green-700">About & contact</Link>
          <Link to="/garages/join" className="hover:text-green-700">For garages</Link>
          <Link to="/plans" className="hover:text-green-700">Plans</Link>
        </nav>
        <p className="text-sm text-navy-700">
          © {new Date().getFullYear()} EcoStream. Prototype.
        </p>
      </div>
    </footer>
  )
}
