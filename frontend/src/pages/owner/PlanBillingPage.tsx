import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Info, Receipt } from 'lucide-react'
import { useOwnerData } from '../../hooks/useOwnerData'
import { planDetails, setTruckPlan } from '../../services/api'
import { ADD_ONS, ANNUAL_DISCOUNT, PLANS, monthlyPrice, type AddOnId, type PlanId } from '../../data/plans'
import { Card, CardTitle, DemoTag, PageHeader, PlanBadge, rupees } from '../../components/owner/ui'
import { ErrorBox, Loading } from '../../components/PageState'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { TruckSummary } from '../../types'

/*
 * Plan & Billing (docs/WEBSITE_SPEC.md section 2.12): current plan per truck, add-ons,
 * upgrade / downgrade, invoices (placeholder: no payments in the demo).
 * Changing a plan here unlocks / locks the cards on that truck's page (in this browser tab).
 * ?truck=<id> highlights one truck (from the "Upgrade" link on a locked card).
 */

const PUBLIC_ADDONS = ADD_ONS.filter((a) => a.public)

export default function PlanBillingPage() {
  const { t } = useLanguage()
  const { trucks, loading, error, reload } = useOwnerData()
  const [params] = useSearchParams()
  const focus = params.get('truck')
  const [annual, setAnnual] = useState(false)
  const [version, setVersion] = useState(0) // bump after a save so the bill and rows re-read the plans

  if (loading && !trucks) return <Loading what="plans" />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  const list = [...(trucks ?? [])].sort((a, b) => Number(b.id === focus) - Number(a.id === focus))
  const total = list.reduce((sum, tr) => sum + monthlyPrice(PLANS.find((p) => p.id === planDetails(tr).plan)!, annual), 0)

  return (
    <>
      <PageHeader title={t('owner.plan')} subtitle={`${list.length} trucks`} right={<DemoTag />} />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3" data-version={version}>
          {list.map((tr) => (
            <TruckPlanRow key={tr.id} truck={tr} highlight={tr.id === focus} annual={annual} onSaved={() => setVersion((v) => v + 1)} />
          ))}
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle>Your bill</CardTitle>
            <div className="inline-flex rounded-lg bg-gray-50 p-1 ring-1 ring-gray-200" role="group" aria-label="Billing">
              {[false, true].map((a) => (
                <button
                  key={String(a)}
                  aria-pressed={annual === a}
                  onClick={() => setAnnual(a)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${annual === a ? 'bg-green-700 text-white' : 'text-navy-700'}`}
                >
                  {a ? `Annual -${ANNUAL_DISCOUNT * 100}%` : 'Monthly'}
                </button>
              ))}
            </div>
            <p className="mt-3 font-heading text-3xl font-extrabold">{rupees(total)}</p>
            <p className="text-sm text-navy-700">per month for all trucks{annual ? `, paid yearly (${rupees(total * 12)})` : ''}</p>
            <p className="mt-1 text-xs text-navy-700">Add-ons: price on request (not included). Lite at the founding-member price.</p>
          </Card>

          <Card>
            <CardTitle>
              <span className="inline-flex items-center gap-1">
                <Receipt size={16} aria-hidden /> Invoices
              </span>
            </CardTitle>
            <p className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm text-navy-700">
              <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
              No payments in the demo, so there are no invoices yet.
            </p>
          </Card>

          <Link to="/plans" className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-500">
            Compare what each plan monitors <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </>
  )
}

function TruckPlanRow({ truck, highlight, annual, onSaved }: { truck: TruckSummary; highlight: boolean; annual: boolean; onSaved: () => void }) {
  const current = planDetails(truck)
  const [plan, setPlan] = useState<PlanId>(current.plan)
  const [addOns, setAddOns] = useState<AddOnId[]>(current.addOns)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => setSaved(false), [plan, addOns])

  const changed = plan !== current.plan || addOns.slice().sort().join() !== current.addOns.slice().sort().join()
  const price = monthlyPrice(PLANS.find((p) => p.id === plan)!, annual)
  const toggle = (id: AddOnId) => setAddOns((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))

  async function save() {
    setBusy(true)
    await setTruckPlan(truck, plan, addOns)
    setBusy(false)
    setSaved(true)
    onSaved()
  }

  return (
    <Card className={highlight ? 'ring-2 ring-green-700' : ''}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to={`/owner/trucks/${truck.id}`} className="font-heading text-lg font-bold hover:text-green-700">
            {truck.reg_no}
          </Link>
          <p className="text-xs text-navy-700">
            {truck.make} {truck.model} · now <PlanBadge plan={current.plan} />
          </p>
        </div>
        <p className="text-right">
          <span className="font-heading text-xl font-extrabold">{rupees(price)}</span>
          <span className="block text-xs text-navy-700">per month</span>
        </p>
      </div>
      {highlight && <p className="mt-2 rounded bg-green-50 px-2 py-1 text-sm text-green-700">Choose a plan or add-on to unlock the locked cards on this truck.</p>}

      <fieldset className="mt-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-navy-700">Plan</legend>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {PLANS.map((p) => (
            <label
              key={p.id}
              className={`cursor-pointer rounded-lg px-2 py-2 text-center text-sm ring-1 ${plan === p.id ? 'bg-green-50 font-bold text-green-700 ring-2 ring-green-700' : 'ring-gray-200 hover:ring-green-300'}`}
            >
              <input type="radio" name={`plan-${truck.id}`} value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} className="sr-only" />
              {p.name}
              <span className="block text-xs font-normal text-navy-700">{rupees(monthlyPrice(p, annual))}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-navy-700">Add-ons</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {PUBLIC_ADDONS.map((a) => {
            const on = addOns.includes(a.id)
            return (
              <label key={a.id} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${on ? 'bg-green-700 text-white ring-green-700' : 'bg-white text-navy-700 ring-gray-200'}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(a.id)} className="sr-only" />
                {on && <CheckCircle2 size={12} aria-hidden />} {a.name}
              </label>
            )
          })}
        </div>
      </fieldset>

      {(changed || saved) && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {changed && (
            <button onClick={save} disabled={busy} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50">
              {busy ? 'Saving…' : plan === current.plan ? 'Save add-ons' : PLANS.findIndex((p) => p.id === plan) > PLANS.findIndex((p) => p.id === current.plan) ? `Upgrade to ${plan.toUpperCase()}` : `Change to ${plan.toUpperCase()}`}
            </button>
          )}
          {saved && (
            <span role="status" className="inline-flex items-center gap-1 text-sm text-green-700">
              <CheckCircle2 size={16} aria-hidden /> Saved (demo: this browser tab only).{' '}
              <Link to={`/owner/trucks/${truck.id}?tab=engine`} className="font-semibold underline">
                See the truck
              </Link>
            </span>
          )}
        </div>
      )}
    </Card>
  )
}
