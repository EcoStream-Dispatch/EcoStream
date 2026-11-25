import { useState } from 'react'
import { Check, MessageCircle, PackagePlus, ReceiptText } from 'lucide-react'
import { getTrucks } from '../services/api'
import { useApi } from '../hooks/useApi'
import PlanBadge from '../components/PlanBadge'
import { ADD_ONS, ADD_ON_PRICE, ANNUAL_DISCOUNT, PLANS, formatInr, planOf } from '../lib/plans'
import { ADD_ON_NAME } from '../lib/parameters'
import type { Plan, TruckSummary } from '../types'
import { useLang } from '../lib/i18n'

/**
 * Plans (Stitch brief screen 7; features and prices from the Excel "Subscription Tiers" sheet).
 * Prices are proposed. There is no payment flow: the button is "Talk to us".
 * "Your subscription" shows each truck's plan and add-ons with the monthly cost
 * (the docs: payments in the first prototype = subscription only). No invoices yet.
 */
export default function PlansPage() {
  const [annual, setAnnual] = useState(false)
  const { t: tr } = useLang()
  const [asked, setAsked] = useState<Plan | null>(null)
  const trucksQ = useApi(getTrucks, [])

  // How many of the owner's trucks are on each plan
  const onPlan: Record<Plan, number> = { lite: 0, pro: 0, fleet: 0 }
  for (const t of trucksQ.data ?? []) onPlan[planOf(t)]++

  return (
    <>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">{tr('plans.title')}</h1>
          <p className="mt-1 text-navy-700">{tr('plans.sub')}</p>
        </div>
        {/* Monthly / annual switch */}
        <div className="inline-flex self-start rounded-lg bg-white p-1 ring-1 ring-gray-200" role="group" aria-label="Billing">
          {[
            { v: false, label: tr('plans.monthly') },
            { v: true, label: tr('plans.annual') },
          ].map(({ v, label }) => (
            <button
              key={label}
              type="button"
              aria-pressed={annual === v}
              onClick={() => setAnnual(v)}
              className={`min-h-[44px] rounded-md px-4 text-sm font-semibold transition ${
                annual === v ? 'bg-green-700 text-white' : 'text-navy-700 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {trucksQ.data && trucksQ.data.length > 0 && <Subscription trucks={trucksQ.data} />}

      <ul className="mt-5 grid gap-4 md:grid-cols-3">
        {PLANS.map((p, i) => {
          const featured = p.id === 'pro'
          const yearly = p.priceInr * 12 * (1 - ANNUAL_DISCOUNT)
          return (
            <li
              key={p.id}
              className={`flex flex-col rounded-2xl bg-white p-5 shadow-sm ${featured ? 'ring-2 ring-green-700' : 'ring-1 ring-gray-200'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <PlanBadge plan={p.id} className="text-xs" />
                {featured && (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">Most useful</span>
                )}
              </div>
              <h2 className="mt-3 text-2xl font-extrabold">{p.name}</h2>
              <p className="text-sm text-navy-700">{p.tagline}</p>

              <p className="mt-4 flex items-baseline gap-1">
                <span className="font-heading text-4xl font-extrabold">{formatInr(annual ? yearly / 12 : p.priceInr)}</span>
                <span className="text-sm text-navy-700">{tr('plans.perTruck')}</span>
              </p>
              <p className="min-h-[20px] text-xs text-navy-700">
                {annual ? `${formatInr(yearly)} per truck, paid once a year (list ${formatInr(p.priceInr * 12)})` : 'Billed monthly'}
              </p>

              {i > 0 && <p className="mt-4 text-sm font-semibold">Everything in {PLANS[i - 1].name}, plus:</p>}
              <ul className={`${i > 0 ? 'mt-2' : 'mt-4'} flex-1 space-y-2`}>
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm">
                    <Check size={18} className="mt-0.5 shrink-0 text-green-700" aria-hidden /> {f}
                  </li>
                ))}
              </ul>

              {trucksQ.data && (
                <p className="mt-4 text-xs font-semibold text-navy-700">
                  {onPlan[p.id] === 0 ? 'None of your trucks are on this plan' : `${onPlan[p.id]} of your trucks on this plan`}
                </p>
              )}
              <button
                type="button"
                onClick={() => setAsked(p.id)}
                className={`mt-3 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg font-semibold transition ${
                  featured ? 'bg-green-700 text-white hover:bg-green-500' : 'border-2 border-green-700 text-green-700 hover:bg-green-50'
                }`}
              >
                <MessageCircle size={18} aria-hidden /> {tr('plans.talk')}
              </button>
              {asked === p.id && (
                <p className="mt-2 text-sm text-navy-700" role="status">
                  The app can't change plans or take payments yet. Please ask your EcoStream contact to move trucks to{' '}
                  {p.name}.
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <p className="mt-3 text-sm text-navy-700">{tr('plans.proposed')}</p>

      {/* Add-ons */}
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200" aria-labelledby="addons-heading">
        <h2 id="addons-heading" className="flex items-center gap-2 text-lg font-bold">
          <PackagePlus size={20} className="text-green-700" aria-hidden /> {tr('plans.addons')}
        </h2>
        <p className="text-sm text-navy-700">Add to any plan. Not available in the prototype yet.</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {ADD_ONS.map((a) => (
            <li key={a.name} className="rounded-xl bg-green-50 p-4">
              <p className="font-semibold">{a.name}</p>
              <p className="text-sm text-navy-700">{a.price}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

/** What the owner pays today: one row per truck, plan + add-ons, and the monthly total. */
function Subscription({ trucks }: { trucks: TruckSummary[] }) {
  const { t: tr } = useLang()
  const rows = trucks.map((t) => {
    const plan = PLANS.find((p) => p.id === planOf(t))!
    const addOns = t.add_ons ?? []
    const priced = addOns.reduce((n, a) => n + (ADD_ON_PRICE[a] ?? 0), 0)
    const unpriced = addOns.some((a) => ADD_ON_PRICE[a] === null)
    return { t, plan, addOns, monthly: plan.priceInr + priced, unpriced }
  })
  const total = rows.reduce((n, r) => n + r.monthly, 0)
  const anyUnpriced = rows.some((r) => r.unpriced)

  return (
    <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200" aria-labelledby="sub-heading">
      <h2 id="sub-heading" className="flex items-center gap-2 text-lg font-bold">
        <ReceiptText size={20} className="text-green-700" aria-hidden /> {tr('plans.yours')}
      </h2>
      <p className="text-sm text-navy-700">{tr('plans.yoursSub')}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-navy-700">
              <th className="py-2 pr-3 font-semibold">{tr('plans.truckCol')}</th>
              <th className="py-2 pr-3 font-semibold">{tr('plans.planCol')}</th>
              <th className="py-2 pr-3 font-semibold">{tr('plans.addonsCol')}</th>
              <th className="py-2 text-right font-semibold">{tr('plans.perMonthCol')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(({ t, plan, addOns, monthly, unpriced }) => (
              <tr key={t.id}>
                <td className="whitespace-nowrap py-2.5 pr-3 font-heading font-bold">{t.reg_no}</td>
                <td className="py-2.5 pr-3">
                  <PlanBadge plan={plan.id} className="text-xs" />
                </td>
                <td className="py-2.5 pr-3 text-navy-700">
                  {addOns.length
                    ? addOns.map((a) => `${ADD_ON_NAME[a]}${ADD_ON_PRICE[a] === null ? '*' : ''}`).join(', ')
                    : tr('plans.none')}
                </td>
                <td className="py-2.5 text-right font-semibold">
                  {formatInr(monthly)}
                  {unpriced && '*'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200">
              <td colSpan={3} className="py-2.5 pr-3 font-bold">
                {tr('plans.total')}
              </td>
              <td className="py-2.5 text-right font-heading text-lg font-extrabold">
                {formatInr(total)}
                {anyUnpriced && '*'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {anyUnpriced && <p className="mt-1 text-xs text-navy-700">* {tr('plans.priceAsk')}</p>}
      <p className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-navy-700">{tr('plans.invoicesLater')}</p>
    </section>
  )
}
