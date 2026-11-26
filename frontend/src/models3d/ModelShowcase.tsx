import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import ModelViewer, { useModelMeta } from './ModelViewer'
import { useManifest } from './useManifest'
import { useLang } from '../lib/i18n'

/**
 * Landing-page section: the Blender wheel with the sealed EcoStream sensor, in the 3D viewer.
 * The model only loads once the section is close to the screen.
 */
export default function ModelShowcase({ modelId = 'wheel' }: { modelId?: string }) {
  const { t } = useLang()
  const ref = useRef<HTMLElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const { manifest } = useManifest()
  const model = near ? manifest?.models.find((m) => m.id === modelId) : undefined
  const meta = useModelMeta(model)

  return (
    <section ref={ref} className="mx-auto max-w-6xl px-4 py-14 md:py-20" aria-labelledby="showcase-title">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">{t('showcase.kicker')}</p>
      <h2 id="showcase-title" className="mt-2 font-heading text-3xl font-extrabold text-navy-900 md:text-4xl">
        {t('showcase.title')}
      </h2>
      <p className="mt-2 max-w-2xl text-navy-700">{t('showcase.sub')}</p>
      <div className="mt-6">
        {model && meta ? (
          <ModelViewer model={model} meta={meta} showPartList={false} height="h-[380px] md:h-[520px]" />
        ) : (
          <div className="h-[380px] animate-pulse rounded-2xl bg-white ring-1 ring-green-500/15 md:h-[520px]" aria-hidden />
        )}
      </div>
      <Link to="/models" className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-green-700 hover:text-green-500">
        {t('showcase.more')} <ArrowRight size={18} aria-hidden />
      </Link>
    </section>
  )
}
