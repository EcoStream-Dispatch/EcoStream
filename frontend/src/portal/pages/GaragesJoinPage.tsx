import { useState, type FormEvent } from 'react'
import { BadgeCheck, CheckCircle2, ClipboardCheck, Clock, MapPinned, PhoneCall, Send, Wrench, type LucideIcon } from 'lucide-react'
import PublicLayout, { PageIntro } from '../components/PublicLayout'
import { DemoFormNote, TextArea, TextField, primaryButton } from '../components/Form'
import { PUBLIC_FORMS_MOCKED, submitGarageSignup, type GarageSignup } from '../services/api'

/*
 * For garages (docs/WEBSITE_SPEC.md, public page 3):
 * benefits, how verification works, and a sign-up form.
 * The form is mocked for now (see submitGarageSignup in src/services/api.ts).
 */

const BENEFITS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: MapPinned, title: 'Trucks near you find you', text: 'When a truck nearby has a tyre, brake or engine problem, the owner sees your garage in the list.' },
  { icon: Clock, title: 'Work at night too', text: 'Open 24x7? We show that clearly, so you get the 2 a.m. jobs other garages miss.' },
  { icon: ClipboardCheck, title: 'Know the problem first', text: 'The owner shares what our sensors found, so you know what parts and tools to bring.' },
]

const STEPS: { title: string; text: string }[] = [
  { title: 'Sign up', text: 'Fill in the form below with your garage details.' },
  { title: 'We call you', text: 'Our team calls to confirm your services, hours and location.' },
  { title: 'Visit and check', text: 'We visit the garage to check tools, space and safety.' },
  { title: 'Go live', text: 'Your garage shows as "Verified" to truck owners nearby.' },
]

const SERVICES: { value: GarageSignup['services'][number]; label: string }[] = [
  { value: 'tyre', label: 'Tyre (puncture, replacement, retread)' },
  { value: 'air_brake', label: 'Air brake' },
  { value: 'engine', label: 'Engine' },
]

const EMPTY: GarageSignup = { garage_name: '', contact_name: '', phone: '', city: '', services: [], open_24x7: false, notes: '' }

export default function GaragesJoinPage() {
  return (
    <PublicLayout>
      <PageIntro
        title="Join our verified 24x7 garage network"
        text="Truck owners on the Chennai - Krishnagiri - Salem - Namakkal corridor need help they can trust, at any hour."
      >
        <a href="#signup" className={`${primaryButton} mt-6`}>
          <Wrench size={18} aria-hidden /> Sign up your garage
        </a>
      </PageIntro>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">Why join</h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-navy-900/10">
              <Icon size={30} className="text-green-700" strokeWidth={1.75} aria-hidden />
              <h3 className="mt-3 font-bold">{title}</h3>
              <p className="mt-2 text-sm text-navy-700">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-green-50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">How verification works</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-navy-900/5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 font-heading font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-navy-700">{s.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-navy-700">
            <BadgeCheck size={18} className="text-green-700" aria-hidden />
            Joining is free during the prototype stage.
          </p>
        </div>
      </section>

      <section id="signup" className="mx-auto max-w-2xl scroll-mt-20 px-4 py-12">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">Sign up your garage</h2>
        <SignupForm />
      </section>
    </PublicLayout>
  )
}

function SignupForm() {
  const [form, setForm] = useState<GarageSignup>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [reference, setReference] = useState<string | null>(null)

  const set = <K extends keyof GarageSignup>(key: K, value: GarageSignup[K]) => setForm((f) => ({ ...f, [key]: value }))
  const toggleService = (s: GarageSignup['services'][number]) =>
    set('services', form.services.includes(s) ? form.services.filter((x) => x !== s) : [...form.services, s])

  const phoneOk = /^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, '').slice(-10))
  const ready = form.garage_name && form.contact_name && phoneOk && form.city && form.services.length > 0

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    const { reference } = await submitGarageSignup(form)
    setBusy(false)
    setReference(reference)
  }

  if (reference)
    return (
      <div role="status" className="mt-8 rounded-xl bg-green-50 p-6 text-center ring-1 ring-green-500/30">
        <CheckCircle2 size={36} className="mx-auto text-green-700" aria-hidden />
        <p className="mt-3 font-bold">Thank you, {form.contact_name}.</p>
        <p className="mt-1 text-sm text-navy-700">
          {PUBLIC_FORMS_MOCKED
            ? `Demo only: nothing was sent. Reference ${reference}.`
            : `We will call you on ${form.phone}. Reference ${reference}.`}
        </p>
        <button type="button" onClick={() => { setForm(EMPTY); setReference(null) }} className="mt-4 text-sm font-semibold text-green-700 hover:text-green-500">
          Sign up another garage
        </button>
      </div>
    )

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-navy-900/10 sm:p-6">
      <TextField label="Garage name" required value={form.garage_name} onChange={(e) => set('garage_name', e.target.value)} />
      <TextField label="Your name" required autoComplete="name" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
      <TextField
        label="Mobile number"
        required
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="10-digit mobile"
        value={form.phone}
        onChange={(e) => set('phone', e.target.value)}
        aria-invalid={form.phone !== '' && !phoneOk}
      />
      {form.phone !== '' && !phoneOk && <p className="-mt-2 text-sm text-critical">Enter a 10-digit Indian mobile number.</p>}
      <TextField label="Town / city" required placeholder="e.g. Krishnagiri" value={form.city} onChange={(e) => set('city', e.target.value)} />

      <fieldset>
        <legend className="text-sm font-semibold">
          Services <span className="text-critical">*</span>
        </legend>
        <div className="mt-2 space-y-2">
          {SERVICES.map((s) => (
            <label key={s.value} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
              <input type="checkbox" checked={form.services.includes(s.value)} onChange={() => toggleService(s.value)} className="h-5 w-5 accent-green-700" />
              <span className="text-sm">{s.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
        <input type="checkbox" checked={form.open_24x7} onChange={(e) => set('open_24x7', e.target.checked)} className="h-5 w-5 accent-green-700" />
        <span className="text-sm font-semibold">We are open 24x7</span>
      </label>

      <TextArea label="Anything else" value={form.notes} onChange={(e) => set('notes', e.target.value)} />

      {PUBLIC_FORMS_MOCKED && <DemoFormNote />}
      <button type="submit" disabled={!ready || busy} className={`${primaryButton} w-full`}>
        <Send size={18} aria-hidden /> {busy ? 'Sending…' : 'Send sign-up'}
      </button>
      <p className="flex items-center justify-center gap-2 text-xs text-navy-700">
        <PhoneCall size={14} aria-hidden /> We only use your number to call you about joining.
      </p>
    </form>
  )
}
