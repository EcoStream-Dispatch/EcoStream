import { useLang } from '../lib/i18n'
import { Body, HotLeakPanel, Kicker, LeakReadout, Title } from './StoryCard'

/*
 * The story of the 3D landing page, without 3D or scroll animation, for visitors who
 * asked their device for reduced motion (or whose browser can't draw WebGL).
 * Same words and the same honest demo numbers; the hot-vs-leak slider still works.
 * Imports no three.js, so it stays in the main bundle cheaply.
 */
export default function StaticStory() {
  const { t } = useLang()
  const steps = ['l3d.journey.s0', 'l3d.journey.s1', 'l3d.journey.s2', 'l3d.journey.s3', 'l3d.journey.s4'] as const
  const card = 'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-green-500/15 md:p-7'
  return (
    <section className="bg-green-50" aria-labelledby="static-story">
      <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <h2 id="static-story" className="sr-only">
          {t('l3d.static.kicker')}
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          <article className={card}>
            <Kicker>{t('l3d.xray.kicker')}</Kicker>
            <Title>{t('l3d.xray.title')}</Title>
            <Body>{t('l3d.xray.body')}</Body>
          </article>
          <article className={card}>
            <Kicker>{t('l3d.leak.kicker')}</Kicker>
            <Title>{t('l3d.leak.title')}</Title>
            <Body>{t('l3d.leak.body')}</Body>
            <LeakReadout fixed={1} />
          </article>
          <article className={card}>
            <Kicker>{t('l3d.hot.kicker')}</Kicker>
            <Title>{t('l3d.hot.title')}</Title>
            <Body>{t('l3d.hot.body')}</Body>
            <HotLeakPanel staticMode />
          </article>
          <article className={card}>
            <Kicker>{t('l3d.journey.kicker')}</Kicker>
            <Title>{t('l3d.journey.title')}</Title>
            <Body>{t('l3d.journey.body')}</Body>
            <ol className="mt-4 space-y-2">
              {steps.map((k, i) => (
                <li key={k} className="flex items-center gap-3 text-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-700 font-heading text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="text-navy-900">{t(k)}</span>
                </li>
              ))}
            </ol>
            <div className="mt-6 border-t border-gray-100 pt-5">
              <Kicker>{t('l3d.map.kicker')}</Kicker>
              <Body>{t('l3d.map.body')}</Body>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
