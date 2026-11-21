import { bookGarageHref } from '../../../services/api'
import { Link } from 'react-router-dom'
import { CheckCircle2, Wrench } from 'lucide-react'
import { RiskBadge, rupees } from '../../../components/owner/ui'
import type { Prediction, TruckSummary } from '../../../types'

/*
 * Predictions tab: per component risk, predicted issue, time window, confidence,
 * recommended action and "Book garage".
 * Tyre predictions are worked out from the live alerts (e.g. leak rate -> "unsafe in ~6 h");
 * the others, and all costs, are sample data.
 */
export default function PredictionsTab({ predictions }: { truck?: TruckSummary; predictions: Prediction[] }) {
  if (predictions.length === 0)
    return (
      <p className="flex items-center gap-2 rounded-xl bg-white p-4 text-green-700 ring-1 ring-gray-200">
        <CheckCircle2 size={18} aria-hidden /> No problems predicted for this truck.
      </p>
    )
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {predictions.map((p) => (
        <li key={p.id} className="flex flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-navy-700">{p.component}</span>
            <RiskBadge risk={p.risk} />
          </div>
          <h3 className="mt-2 font-bold">{p.issue}</h3>
          <p className="mt-1 font-heading text-lg font-extrabold">{p.window}</p>
          <p className="mt-1 text-sm text-navy-700">{p.action}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-gray-50 p-2">
              <dt className="text-navy-700">Confidence</dt>
              <dd className="font-semibold">{p.confidence_pct}%</dd>
            </div>
            <div className="rounded-lg bg-gray-50 p-2">
              <dt className="text-navy-700">Fix now</dt>
              <dd className="font-semibold">{rupees(p.cost_now)}</dd>
            </div>
            <div className="rounded-lg bg-gray-50 p-2">
              <dt className="text-navy-700">If ignored</dt>
              <dd className="font-semibold">{rupees(p.cost_if_ignored)}</dd>
            </div>
          </dl>
          {p.needs_garage && (
            <Link
              to={bookGarageHref(p)}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 sm:self-start"
            >
              <Wrench size={16} aria-hidden /> Book garage
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}
