import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Send } from 'lucide-react'
import { requestShipment } from '../../services/api'
import { CORRIDOR } from '../../lib/route'
import { primaryButton } from '../../components/Form'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { ShipmentRequest } from '../../types'

/*
 * Shipper: Request a shipment (docs/WEBSITE_SPEC.md section 4.1): pickup, drop,
 * goods type, weight, date. Goes to the transporter (owner) to accept.
 * Demo: kept in this browser tab only.
 */

const GOODS = ['General goods', 'Textiles', 'Auto parts', 'Steel', 'FMCG cartons', 'Chilled food (2-8 °C)', 'Other']
const input = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-300'

function inDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function RequestShipmentPage() {
  const { t } = useLanguage()
  const [f, setF] = useState({ pickup_city: 'Chennai', pickup_address: '', drop_city: 'Salem', drop_address: '', goods: GOODS[0], weight: '10', date: inDays(1) })
  const [tried, setTried] = useState(false)
  const [done, setDone] = useState<ShipmentRequest | null>(null)
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))
  const weight = Number(f.weight)
  const ok = f.pickup_address.trim() && f.drop_address.trim() && f.pickup_city !== f.drop_city && weight > 0 && weight <= 40 && f.date >= inDays(0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!ok) return
    setDone(
      await requestShipment({
        pickup_city: f.pickup_city,
        pickup_address: f.pickup_address.trim(),
        drop_city: f.drop_city,
        drop_address: f.drop_address.trim(),
        goods: f.goods,
        weight_t: weight,
        date: f.date,
      }),
    )
  }

  if (done)
    return (
      <div role="status" className="rounded-xl bg-green-50 p-6 text-center ring-1 ring-green-500/30">
        <CheckCircle2 size={40} className="mx-auto text-green-700" aria-hidden />
        <p className="mt-2 text-lg font-bold">Request {done.id} sent</p>
        <p className="text-sm text-navy-700">
          {done.pickup_city} → {done.drop_city}, {done.goods}, {done.weight_t} t. The transporter will confirm the truck. (Demo: kept in this browser only.)
        </p>
        <Link to="/shipper" className="mt-4 inline-block rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white">
          {t('shipper.shipments')}
        </Link>
      </div>
    )

  return (
    <>
      <Link to="/shipper" className="inline-flex items-center gap-1 text-sm font-semibold text-green-700">
        <ArrowLeft size={16} aria-hidden /> {t('shipper.shipments')}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{t('shipper.request')}</h1>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pickup town">
            <select value={f.pickup_city} onChange={(e) => set('pickup_city', e.target.value)} className={input}>
              {CORRIDOR.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Drop town">
            <select value={f.drop_city} onChange={(e) => set('drop_city', e.target.value)} className={input}>
              {CORRIDOR.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Pickup address">
            <input value={f.pickup_address} onChange={(e) => set('pickup_address', e.target.value)} className={`${input} ${tried && !f.pickup_address.trim() ? 'border-critical' : ''}`} />
          </Field>
          <Field label="Drop address">
            <input value={f.drop_address} onChange={(e) => set('drop_address', e.target.value)} className={`${input} ${tried && !f.drop_address.trim() ? 'border-critical' : ''}`} />
          </Field>
          <Field label="Goods type">
            <select value={f.goods} onChange={(e) => set('goods', e.target.value)} className={input}>
              {GOODS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weight (t)">
              <input type="number" inputMode="decimal" min={0.5} max={40} step={0.5} value={f.weight} onChange={(e) => set('weight', e.target.value)} className={input} />
            </Field>
            <Field label="Date">
              <input type="date" min={inDays(0)} value={f.date} onChange={(e) => set('date', e.target.value)} className={input} />
            </Field>
          </div>
        </div>
        {tried && !ok && <p className="text-sm text-critical">Fill in both addresses, choose two different towns, a weight up to 40 t and a date from today.</p>}
        <button type="submit" className={`${primaryButton} w-full sm:w-auto`}>
          <Send size={18} aria-hidden /> Send request
        </button>
      </form>
    </>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  )
}
