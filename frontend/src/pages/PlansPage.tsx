import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, Check, ChevronDown, Minus, PlusCircle } from 'lucide-react'
import PublicLayout, { PageIntro } from '../components/PublicLayout'
import { primaryButton, secondaryButton } from '../components/Form'
import {
  ADD_ONS,
  ANNUAL_DISCOUNT,
  PLANS,
  addOnName,
  availability,
  monthlyPrice,
  paramsByGroup,
  type Param,
  type PlanId,
} from '../data/plans'
import { useLanguage } from '../i18n/LanguageProvider'

/*
 * Plans & pricing (docs/WEBSITE_SPEC.md, public page 2).
 * Prices, plans and the comparison table all come from src/data/plans.ts.
 */

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`

export default function PlansPage() {
  const [annual, setAnnual] = useState(false)
  const { t } = useLanguage()

  return (
    <PublicLayout>
      <PageIntro title="Plans & pricing" text="Simple monthly price per truck. Start with tyres, add engine and cargo when you need them.">
        {/* Monthly / annual switch */}
        <div className="mt-6 inline-flex rounded-lg bg-white p-1 ring-1 ring-gray-200" role="group" aria-label="Billing">
          {[false, true].map((isAnnual) => (
            <button
              key={String(isAnnual)}
              type="button"
              aria-pressed={annual === isAnnual}
              onClick={() => setAnnual(isAnnual)}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                annual === isAnnual ? 'bg-green-700 text-white' : 'text-navy-700 hover:bg-gray-100'
              }`}
            >
              {isAnnual ? `Annual prepaid -${ANNUAL_DISCOUNT * 100}%` : 'Monthly'}
            </button>
          ))}
        </div>
      </PageIntro>

      {/* ---------- Plan cards ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const price = monthlyPrice(plan, annual)
            const list = plan.listPrice && (annual ? monthlyPrice({ ...plan, price: plan.listPrice }, true) : plan.listPrice)
            return (
              <article key={plan.id} className="flex flex-col rounded-xl bg-white p-6 shadow-sm ring-1 ring-navy-900/10">
                <h2 className="font-heading text-xl font-extrabold uppercase tracking-wide">{plan.name}</h2>
                <p className="mt-1 min-h-[2.5rem] text-sm text-navy-700">{plan.summary}</p>

                <div className="mt-4">
                  {plan.offerNote && (
                    <span className="inline-block rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-green-500/30">
                      {plan.offerNote}
                    </span>
                  )}
                  <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
                    <span className="font-heading text-4xl font-extrabold">{rupees(price)}</span>
                    {list && (
                      <span className="text-lg text-navy-700 line-through" aria-label={`normal price ${rupees(list)}`}>
                        {rupees(list)}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-navy-700">
                    per truck / month{annual && `, paid yearly (${rupees(price * 12)} per truck)`}
                  </p>
                </div>

                <ul className="mt-5 flex-1 space-y-2">
                  {plan.highlights.map((h) => (
                    <li key={h} className="flex gap-2 text-sm">
                      <Check size={18} className="mt-0.5 shrink-0 text-green-500" aria-hidden />
                      {h}
                    </li>
                  ))}
                </ul>

                <Link to={`/about?topic=demo&plan=${plan.id}#contact`} className={`${primaryButton} mt-6 w-full`}>
                  <CalendarCheck size={18} aria-hidden /> {t('nav.bookDemo')}
                </Link>
              </article>
            )
          })}
        </div>
        <p className="mt-4 text-center text-sm text-navy-700">
          Prices are for the monitoring subscription. Ask us about sensor hardware and fitting.
        </p>
      </section>

      {/* ---------- Comparison table ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">What each plan monitors</h2>
        <p className="mt-2 text-center text-sm text-navy-700">Tap a group to open it.</p>
        <ComparisonTable />
      </section>

      {/* ---------- Add-ons ---------- */}
      <section className="bg-green-50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Add-ons</h2>
          <p className="mt-2 text-center text-navy-700">Extra sensors for special loads and bigger risks. Price on request.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ADD_ONS.filter((a) => a.public).map((a) => (
              <li key={a.id} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-navy-900/5">
                <h3 className="flex items-center gap-2 font-bold">
                  <PlusCircle size={20} className="text-green-700" aria-hidden /> {a.name}
                </h3>
                <p className="mt-2 text-sm text-navy-700">{a.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 text-center">
            <Link to="/about?topic=question#contact" className={secondaryButton}>
              Ask about add-ons
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}

const PLAN_COLUMNS: { id: PlanId; name: string }[] = PLANS.map((p) => ({ id: p.id, name: p.name }))

/** One cell: ✓ Included / + Add-on / – Not included. Icon + hidden word for screen readers. */
function Cell({ param, plan }: { param: Param; plan: PlanId }) {
  const a = availability(param, plan)
  if (a === 'included')
    return (
      <span className="inline-flex justify-center text-green-700" title="Included">
        <Check size={20} aria-hidden />
        <span className="sr-only">Included</span>
      </span>
    )
  if (a === 'addon')
    return (
      <span
        className="inline-flex items-center gap-0.5 text-xs font-semibold text-navy-700"
        title={'addOn' in param.unlock ? `Add-on: ${addOnName(param.unlock.addOn)}` : 'Add-on'}
      >
        <PlusCircle size={14} aria-hidden /> Add-on
      </span>
    )
  return (
    <span className="inline-flex justify-center text-gray-400" title="Not included">
      <Minus size={18} aria-hidden />
      <span className="sr-only">Not included</span>
    </span>
  )
}

/**
 * Comparison table, split by group (Tyres, Engine, ...).
 * Each group opens and closes, so the page stays short on phones. Tyres starts open.
 */
function ComparisonTable() {
  return (
    <div className="mt-8 space-y-3">
      {paramsByGroup().map(({ group, params }, i) => (
        <details key={group} open={i === 0} className="group overflow-hidden rounded-xl bg-white ring-1 ring-navy-900/10">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-green-50 px-4 py-3 font-heading font-bold text-navy-900 [&::-webkit-details-marker]:hidden">
            <span>
              {group === 'Engine' ? 'Engine (from the truck’s CAN bus)' : group}
              <span className="ml-2 text-xs font-semibold text-navy-700">{params.length}</span>
            </span>
            <ChevronDown size={20} className="shrink-0 transition group-open:rotate-180" aria-hidden />
          </summary>
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <colgroup>
              <col />
              <col className="w-[4.5rem] sm:w-28" />
              <col className="w-[4.5rem] sm:w-28" />
              <col className="w-[4.5rem] sm:w-28" />
            </colgroup>
            <thead className="bg-navy-900 text-white">
              <tr>
                <th scope="col" className="px-3 py-2 text-xs font-semibold">
                  Parameter
                </th>
                {PLAN_COLUMNS.map((p) => (
                  <th key={p.id} scope="col" className="px-1 py-2 text-center font-heading text-xs font-bold uppercase">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {params.map((p) => (
                <tr key={p.key} className="border-t border-gray-100">
                  <th scope="row" className="px-3 py-2.5 font-normal">
                    <span className="block font-semibold text-navy-900">{p.name}</span>
                    <span className="block text-xs text-navy-700">{p.unit}</span>
                  </th>
                  {PLAN_COLUMNS.map((c) => (
                    <td key={c.id} className="px-1 py-2.5 text-center">
                      <Cell param={p} plan={c.id} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </div>
  )
}
