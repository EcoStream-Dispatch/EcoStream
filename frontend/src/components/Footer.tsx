import Wordmark from './Wordmark'

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <Wordmark className="text-base" />
        <p className="text-sm text-navy-700">
          © {new Date().getFullYear()} EcoStream. Prototype.
        </p>
      </div>
    </footer>
  )
}
