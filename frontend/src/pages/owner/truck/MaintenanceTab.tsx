import { AlertTriangle, CheckCircle2, FileText, OctagonAlert } from 'lucide-react'
import { Card, CardTitle, daysFromNow, dueText, formatDate, rupees } from '../../../components/owner/ui'
import type { ComplianceDoc, MaintenanceItem, TruckDetails } from '../../../types'

/*
 * Maintenance & documents tab: service history, garage jobs, upcoming services,
 * and compliance reminders (permit, fitness, PUC, insurance, road tax). Sample data.
 */
export default function MaintenanceTab({ details }: { details: TruckDetails }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardTitle>Documents and compliance</CardTitle>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {[...details.documents].sort((a, b) => a.due.localeCompare(b.due)).map((d) => (
            <DocItem key={d.name} doc={d} />
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Upcoming services</CardTitle>
        <ul className="divide-y divide-gray-100">
          <ServiceRow
            item={{
              date: details.profile.next_service.date,
              title: `${details.profile.next_service.what} (at ${details.profile.next_service.km.toLocaleString('en-IN')} km)`,
              where: 'Planned service',
              cost: null,
            }}
          />
          {details.upcoming.map((m, i) => (
            <ServiceRow key={i} item={m} />
          ))}
        </ul>
        <p className="mt-2 text-xs text-navy-700">Odometer now: {details.profile.odometer_km.toLocaleString('en-IN')} km</p>
      </Card>

      <Card>
        <CardTitle>Service history and garage jobs</CardTitle>
        <ul className="divide-y divide-gray-100">
          {details.service_history.map((m, i) => (
            <ServiceRow key={i} item={m} past />
          ))}
        </ul>
      </Card>
    </div>
  )
}

function DocItem({ doc }: { doc: ComplianceDoc }) {
  const days = daysFromNow(doc.due)
  const state = days < 0 ? 'critical' : days <= 30 ? 'warning' : 'ok'
  const Icon = state === 'critical' ? OctagonAlert : state === 'warning' ? AlertTriangle : CheckCircle2
  const cls = { critical: 'bg-red-50 text-critical ring-critical/30', warning: 'bg-amber-50 text-amber-800 ring-warning/40', ok: 'bg-green-50 text-green-700 ring-green-500/30' }[state]
  const word = { critical: 'Expired', warning: 'Due soon', ok: 'Valid' }[state]
  return (
    <li className={`rounded-lg p-3 ring-1 ${cls}`}>
      <p className="flex items-center gap-1.5 text-sm font-bold text-navy-900">
        <FileText size={16} aria-hidden /> {doc.name}
      </p>
      <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold">
        <Icon size={14} aria-hidden /> {word}
      </p>
      <p className="text-xs text-navy-700">
        {days < 0 ? 'Expired' : 'Due'} {formatDate(doc.due)} ({dueText(doc.due)})
      </p>
    </li>
  )
}

function ServiceRow({ item, past = false }: { item: MaintenanceItem; past?: boolean }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="font-semibold">{item.title}</p>
        <p className="text-xs text-navy-700">
          {formatDate(item.date)}
          {!past && ` (${dueText(item.date)})`} · {item.where}
        </p>
      </div>
      {item.cost != null && <span className="shrink-0 font-semibold">{rupees(item.cost)}</span>}
    </li>
  )
}
