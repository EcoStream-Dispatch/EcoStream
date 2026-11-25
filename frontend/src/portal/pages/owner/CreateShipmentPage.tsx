import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Send, Sparkles, XCircle } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useOwnerData } from '../../hooks/useOwnerData'
import { createShipment, dispatchCandidates, getDrivers } from '../../services/api'
import { suggestTrucks } from '../../lib/dispatch'
import { CORRIDOR } from '../../lib/route'
import { Card, CardTitle, DemoTag, PageHeader } from '../../components/owner/ui'
import { primaryButton } from '../../components/Form'
import StatusBadge from '../../components/StatusBadge'
import { ErrorBox, Loading } from '../../components/PageState'
import { truckHealth } from '../../lib/status'
import type { Place } from '../../types'

/*
 * Create shipment (docs/WEBSITE_SPEC.md section 2.7): sender, receiver, goods + weight,
 * pickup time, suggested truck + driver (availability, right truck for the goods,
 * truck health), assign, notify shipper. Then opens live routing.
 * Saved in this browser tab only (no shipments backend yet).
 */

const GOODS = ['General goods', 'Textiles', 'Auto parts', 'Steel', 'FMCG cartons', 'Chilled food (2-8 °C)', 'Other'] as const

type PartyForm = { name: string; city: string; address: string; contact: string; phone: string }
const emptyParty = (city: string): PartyForm => ({ name: '', city, address: '', contact: '', phone: '' })

function tomorrowNine(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  // value for <input type="datetime-local"> in local time
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

const toPlace = (p: PartyForm): Place => {
  const c = CORRIDOR.find((x) => x.name === p.city) ?? CORRIDOR[0]
  return { name: p.name.trim(), city: p.city, address: p.address.trim(), contact: p.contact.trim(), phone: p.phone.trim(), lat: c.at[0], lon: c.at[1] }
}

const phoneOk = (v: string) => /^[6-9]\d{9}$/.test(v.replace(/\D/g, '').slice(-10))

export default function CreateShipmentPage() {
  const navigate = useNavigate()
  const { trucks, shipments, loading, error, reload } = useOwnerData()
  const driversQ = useApi(() => (trucks ? getDrivers(trucks) : Promise.resolve([])), [trucks])

  const [sender, setSender] = useState<PartyForm>(emptyParty('Chennai'))
  const [receiver, setReceiver] = useState<PartyForm>(emptyParty('Salem'))
  const [goods, setGoods] = useState<(typeof GOODS)[number]>('General goods')
  const [weight, setWeight] = useState('12')
  const [pickup, setPickup] = useState(tomorrowNine())
  const [truckId, setTruckId] = useState<string | null>(null)
  const [driverId, setDriverId] = useState<string | null>(null)
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)

  const coldChain = goods.startsWith('Chilled')
  const weightT = Number(weight)

  const suggestions = useMemo(() => {
    if (!trucks || !shipments || !driversQ.data || !(weightT > 0)) return []
    const from = CORRIDOR.find((c) => c.name === sender.city)?.at ?? CORRIDOR[0].at
    return suggestTrucks(
      { weight_t: weightT, cold_chain: coldChain, pickup_at: new Date(pickup).toISOString(), from },
      dispatchCandidates(trucks, shipments, driversQ.data),
      driversQ.data,
    )
  }, [trucks, shipments, driversQ.data, weightT, coldChain, pickup, sender.city])

  // Default choice: the top suggestion (until the owner picks another).
  const chosen = suggestions.find((s) => s.truck.id === truckId && s.ok) ?? suggestions.find((s) => s.ok) ?? null
  const chosenDriver = driverId ?? chosen?.driver?.id ?? null

  if (loading && !trucks) return <Loading what="trucks" />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  const partyOk = (p: PartyForm) => p.name.trim() && p.address.trim() && p.contact.trim() && phoneOk(p.phone)
  const ready = partyOk(sender) && partyOk(receiver) && sender.city !== receiver.city && weightT > 0 && !!chosen

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!ready || !chosen || !trucks) return
    setBusy(true)
    const s = await createShipment(trucks, {
      sender: toPlace(sender),
      receiver: toPlace(receiver),
      goods,
      weight_t: weightT,
      cold_chain: coldChain,
      pickup_at: new Date(pickup).toISOString(),
      truck_id: chosen.truck.id,
      driver_id: chosenDriver,
      notify_shipper: notify,
    })
    navigate(`/owner/shipments/${s.id}`, { state: { created: true, notified: notify } })
  }

  return (
    <>
      <Link to="/owner/shipments" className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-500">
        <ArrowLeft size={16} aria-hidden /> Shipments
      </Link>
      <PageHeader title="Create shipment" right={<DemoTag />} />

      <form onSubmit={onSubmit} className="grid gap-4 xl:grid-cols-[1fr_420px]" noValidate>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <PartyCard title="Sender (pickup)" value={sender} onChange={setSender} tried={tried} />
            <PartyCard title="Receiver (drop)" value={receiver} onChange={setReceiver} tried={tried} />
          </div>
          {tried && sender.city === receiver.city && <p className="text-sm text-critical">Sender and receiver must be in different towns.</p>}

          <Card>
            <CardTitle>Goods and pickup</CardTitle>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Goods type">
                <select value={goods} onChange={(e) => setGoods(e.target.value as (typeof GOODS)[number])} className={input}>
                  {GOODS.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </Field>
              <Field label="Weight (tonnes)">
                <input type="number" inputMode="decimal" min={0.5} max={40} step={0.5} value={weight} onChange={(e) => setWeight(e.target.value)} className={input} />
              </Field>
              <Field label="Pickup date and time">
                <input type="datetime-local" value={pickup} onChange={(e) => setPickup(e.target.value)} className={input} />
              </Field>
            </div>
            {coldChain && <p className="mt-2 text-sm text-navy-700">Chilled goods: only trucks with cold-chain monitoring are suggested.</p>}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle>
              <span className="inline-flex items-center gap-1">
                <Sparkles size={16} aria-hidden /> Suggested truck + driver
              </span>
            </CardTitle>
            {!driversQ.data ? (
              <p className="text-sm text-navy-700">Working it out…</p>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-navy-700">Enter the weight to see suggestions.</p>
            ) : (
              <fieldset>
                <legend className="sr-only">Choose a truck</legend>
                <ul className="space-y-2">
                  {suggestions.map((s) => {
                    const selected = chosen?.truck.id === s.truck.id
                    return (
                      <li key={s.truck.id}>
                        <label
                          className={`block rounded-lg p-3 ring-1 transition ${
                            !s.ok ? 'cursor-not-allowed bg-gray-50 opacity-70 ring-gray-200' : selected ? 'cursor-pointer bg-green-50 ring-2 ring-green-700' : 'cursor-pointer ring-gray-200 hover:ring-green-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="truck"
                              disabled={!s.ok}
                              checked={selected}
                              onChange={() => {
                                setTruckId(s.truck.id)
                                setDriverId(null)
                              }}
                              className="h-4 w-4 accent-green-700"
                            />
                            <span className="flex-1 font-semibold">{s.truck.reg_no}</span>
                            <StatusBadge status={truckHealth(s.truck)} />
                          </div>
                          <p className="ml-6 text-xs text-navy-700">
                            {s.truck.make} {s.truck.model} · {s.truck.axle_config}
                            {s.ok && s.driver && ` · driver ${s.driver.name}`}
                          </p>
                          <ul className="ml-6 mt-1 space-y-0.5 text-xs">
                            {s.problems.map((r) => (
                              <li key={r} className="flex items-start gap-1 text-critical">
                                <XCircle size={12} className="mt-0.5 shrink-0" aria-hidden /> {r}
                              </li>
                            ))}
                            {s.ok &&
                              s.reasons.map((r) => (
                                <li key={r} className="flex items-start gap-1 text-navy-700">
                                  <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-green-700" aria-hidden /> {r}
                                </li>
                              ))}
                          </ul>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </fieldset>
            )}
            {suggestions.length > 0 && !chosen && <p className="mt-2 text-sm text-critical">No truck fits this shipment. Change the weight or pickup time.</p>}

            {chosen && (
              <Field label="Driver" className="mt-4">
                <select value={chosenDriver ?? ''} onChange={(e) => setDriverId(e.target.value || null)} className={input}>
                  <option value="">No driver yet</option>
                  {(driversQ.data ?? []).map((d) => (
                    <option key={d.id} value={d.id} disabled={d.availability === 'off'}>
                      {d.name} · score {d.score} {d.availability === 'off' ? '(off)' : d.availability === 'available' ? '(available)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </Card>

          <Card>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-5 w-5 accent-green-700" />
              Notify the shipper with a tracking link
            </label>
            {tried && !ready && <p className="mt-3 text-sm text-critical">Fill in all sender and receiver details (10-digit mobile numbers) and choose a truck.</p>}
            <button type="submit" disabled={busy} className={`${primaryButton} mt-4 w-full`}>
              <Send size={18} aria-hidden /> {busy ? 'Assigning…' : 'Assign and create shipment'}
            </button>
            <p className="mt-2 text-xs text-navy-700">Demo: saved in this browser tab only. No message is really sent.</p>
          </Card>
        </div>
      </form>
    </>
  )
}

const input =
  'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 sm:text-sm'

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  )
}

function PartyCard({ title, value, onChange, tried }: { title: string; value: PartyForm; onChange: (p: PartyForm) => void; tried: boolean }) {
  const set = (k: keyof PartyForm, v: string) => onChange({ ...value, [k]: v })
  const bad = (k: keyof PartyForm) => tried && (k === 'phone' ? !phoneOk(value.phone) : !value[k].trim())
  const cls = (k: keyof PartyForm) => `${input} ${bad(k) ? 'border-critical' : ''}`
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className="space-y-3">
        <Field label="Company / name">
          <input value={value.name} onChange={(e) => set('name', e.target.value)} className={cls('name')} aria-invalid={bad('name')} />
        </Field>
        <Field label="Town">
          <select value={value.city} onChange={(e) => set('city', e.target.value)} className={input}>
            {CORRIDOR.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Address">
          <input value={value.address} onChange={(e) => set('address', e.target.value)} className={cls('address')} aria-invalid={bad('address')} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contact person">
            <input value={value.contact} onChange={(e) => set('contact', e.target.value)} className={cls('contact')} aria-invalid={bad('contact')} />
          </Field>
          <Field label="Mobile">
            <input type="tel" inputMode="tel" value={value.phone} onChange={(e) => set('phone', e.target.value)} className={cls('phone')} aria-invalid={bad('phone')} />
          </Field>
        </div>
      </div>
    </Card>
  )
}
