import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, CheckCircle2, Download, PenLine, Printer } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { DEMO_SHIPPER, getShipperShipment, getShipperShipments } from '../../services/api'
import { DemoTag, formatDate, rupees, shortTime } from '../../components/owner/ui'
import { ErrorBox, Loading } from '../../components/PageState'
import { useLanguage } from '../../i18n/LanguageProvider'

/*
 * Shipper: Delivery & invoices (docs/WEBSITE_SPEC.md section 4.3): proof of delivery
 * (photo + signature placeholders), invoice download, history.
 * Invoices are SAMPLE documents: "Download" opens a printable page (Save as PDF).
 */
export default function DeliveriesPage() {
  const { t } = useLanguage()
  const q = useApi(getShipperShipments, [])
  if (q.loading && !q.data) return <Loading what="deliveries" />
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />
  const delivered = q.data!.items.filter((x) => x.shipment.status === 'delivered')

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t('shipper.deliveries')}</h1>
        <DemoTag />
      </div>
      {delivered.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-center text-navy-700 ring-1 ring-gray-200">No deliveries yet.</p>
      ) : (
        <ul className="space-y-4">
          {delivered.map(({ shipment: s, freight }) => (
            <li key={s.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-heading font-bold">{s.id}</p>
                  <p className="text-lg font-bold">
                    {s.sender.city} → {s.receiver.city}
                  </p>
                  <p className="text-sm text-navy-700">
                    {s.goods} · {s.weight_t} t
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-navy-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                  <CheckCircle2 size={14} aria-hidden /> Delivered {shortTime(s.eta)}
                </span>
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-navy-700">Proof of delivery</p>
              <div className="mt-1 grid grid-cols-2 gap-2 sm:max-w-md">
                <Placeholder icon={Camera} text="Photo of goods (placeholder)" />
                <Placeholder icon={PenLine} text={`Signed by ${s.receiver.contact} (placeholder)`} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                <span className="text-sm">
                  Freight: <span className="font-semibold">{freight ? rupees(freight) : 'not billed yet'}</span>
                </span>
                {freight && (
                  <Link to={`/shipper/invoices/${s.id}`} className="inline-flex items-center gap-2 rounded-lg border border-navy-900/20 px-3 py-2 text-sm font-semibold hover:bg-green-50">
                    <Download size={16} aria-hidden /> Download invoice
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function Placeholder({ icon: Icon, text }: { icon: typeof Camera; text: string }) {
  return (
    <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-2 text-center text-xs text-navy-700">
      <Icon size={22} aria-hidden /> {text}
    </div>
  )
}

/** Printable SAMPLE invoice. "Print / Save as PDF" uses the browser's print dialog. */
export function InvoicePage() {
  const { id = '' } = useParams()
  const q = useApi(() => getShipperShipment(id), [id])
  if (q.loading && !q.data) return <Loading what="invoice" />
  if (!q.data || !q.data.freight) return <ErrorBox message="No invoice for this shipment." />
  const { shipment: s, truck, freight } = q.data
  const invoiceNo = `INV-SAMPLE-${s.id.slice(4)}`

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2 print:hidden">
        <Link to="/shipper/deliveries" className="inline-flex items-center gap-1 text-sm font-semibold text-green-700">
          <ArrowLeft size={16} aria-hidden /> Back
        </Link>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white">
          <Printer size={16} aria-hidden /> Print / Save as PDF
        </button>
      </div>
      <article className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 print:shadow-none print:ring-0">
        <p className="rounded bg-amber-50 px-2 py-1 text-center text-xs font-bold uppercase tracking-wide text-amber-900 ring-1 ring-warning/40">
          Sample invoice for the demo. Not a real bill.
        </p>
        <div className="mt-4 flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-navy-700">From (transporter)</p>
            <p className="font-bold">Demo Transport (sample)</p>
            <p className="text-sm text-navy-700">Address: coming soon</p>
          </div>
          <div className="text-right">
            <p className="font-heading text-2xl font-extrabold">Invoice</p>
            <p className="text-sm">{invoiceNo}</p>
            <p className="text-sm text-navy-700">Date: {formatDate(s.eta ?? s.pickup_at)}</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-navy-700">Bill to</p>
          <p className="font-bold">{DEMO_SHIPPER}</p>
        </div>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-navy-700">
            <tr>
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-3">
                Freight {s.id}: {s.sender.city} → {s.receiver.city}
                <span className="block text-xs text-navy-700">
                  {s.goods}, {s.weight_t} t · truck {truck?.reg_no ?? '-'} · delivered {formatDate(s.eta ?? s.pickup_at)}
                </span>
              </td>
              <td className="py-3 text-right font-semibold">{rupees(freight)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="py-3 text-right font-bold">Total</td>
              <td className="py-3 text-right font-heading text-lg font-extrabold">{rupees(freight)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-4 text-xs text-navy-700">Taxes, payment terms and bank details will be added when real billing starts. No payments in the demo.</p>
      </article>
    </>
  )
}
