import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

/**
 * Wrapper for every public page: header, page content, footer.
 * Also scrolls to the top on a new page, or to #section when the link has one.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [pathname, hash])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}

/** Big page title block used at the top of the public pages. */
export function PageIntro({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <section className="bg-green-50">
      <div className="mx-auto max-w-6xl px-4 py-10 text-center sm:py-14">
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {text && <p className="mx-auto mt-3 max-w-2xl text-lg text-navy-700">{text}</p>}
        {children}
      </div>
    </section>
  )
}
