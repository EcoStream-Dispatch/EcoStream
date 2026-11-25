import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import ModelViewer, { useModelMeta } from './ModelViewer'
import { useManifest } from './useManifest'
import { ErrorBox, Loading } from '../components/PageState'
import Wordmark from '../components/Wordmark'
import LanguageSwitch from '../components/LanguageSwitch'
import { asset } from '../lib/asset'
import { useLang } from '../lib/i18n'

/**
 * /models: pick a model and inspect it (orbit, zoom, parts, explode / assemble, animations).
 * Models come from frontend/public/models/manifest.json, built from models/blender.
 */
export default function ModelsPage() {
  const { t } = useLang()
  const { manifest, error } = useManifest()
  const [params, setParams] = useSearchParams()
  const id = params.get('m') ?? manifest?.models[0]?.id
  const model = manifest?.models.find((m) => m.id === id) ?? manifest?.models[0]
  const meta = useModelMeta(model)

  return (
    <div className="min-h-screen bg-green-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link to="/" className="flex items-center gap-2" aria-label="EcoStream home">
            <img src={asset('logo-mark.png')} alt="" className="h-9 w-9 object-contain" />
            <Wordmark className="text-base" />
          </Link>
          <LanguageSwitch className="hidden sm:inline-flex" />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <Link to="/" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-500">
          <ArrowLeft size={16} aria-hidden /> Home
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">{t('models.title')}</h1>
        <p className="mt-1 max-w-2xl text-navy-700">{t('models.sub')}</p>

        {error && <div className="mt-4"><ErrorBox message={error} /></div>}
        {!manifest && !error && <Loading what="models" />}

        {manifest && (
          <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Models">
            {manifest.models.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={m.id === model?.id}
                onClick={() => setParams({ m: m.id }, { replace: true })}
                className={`min-h-[44px] rounded-full px-4 text-sm font-semibold ring-1 transition ${
                  m.id === model?.id ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-navy-900 ring-gray-300 hover:ring-green-500'
                }`}
              >
                {m.title}
              </button>
            ))}
          </div>
        )}

        {model && meta && meta.id === model.id && (
          <div className="mt-4">
            <p className="mb-3 text-sm text-navy-700">{model.description}</p>
            <ModelViewer key={model.id} model={model} meta={meta} />
          </div>
        )}
      </main>
    </div>
  )
}
