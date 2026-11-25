import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, HeartHandshake, MapPin, Send, Target, Truck } from 'lucide-react'
import PublicLayout, { PageIntro } from '../components/PublicLayout'
import { DemoFormNote, SelectField, TextArea, TextField, primaryButton } from '../components/Form'
import { PUBLIC_FORMS_MOCKED, submitContact, type ContactMessage } from '../services/api'
import { PLANS } from '../data/plans'

/*
 * About / Contact (docs/WEBSITE_SPEC.md, public page 4).
 * "Book a demo" buttons link here with ?topic=demo#contact (and &plan=pro etc. from the Plans page).
 * No street address yet: placeholder on purpose.
 */

const TOPICS: { value: ContactMessage['topic']; label: string }[] = [
  { value: 'demo', label: 'Book a demo' },
  { value: 'question', label: 'A question about EcoStream' },
  { value: 'garage', label: 'I run a garage' },
  { value: 'other', label: 'Something else' },
]

export default function AboutPage() {
  return (
    <PublicLayout>
      <PageIntro title="About EcoStream" text="We are building predictive maintenance and smart dispatch for Indian trucks, starting with tyres." />

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-12 md:grid-cols-3">
        <AboutCard icon={Target} title="Our mission">
          Stop breakdowns before they happen. A tyre that is slowly losing air or getting too hot should be a message on the
          owner’s phone, not a truck stuck on the highway.
        </AboutCard>
        <AboutCard icon={Truck} title="Where we start">
          Tamil Nadu first, on the Chennai - Krishnagiri - Salem - Namakkal corridor, with tyre pressure and temperature.
          Engine, brakes and cargo come next.
        </AboutCard>
        <AboutCard icon={HeartHandshake} title="Who we work with">
          Truck owners with 1 to 200 trucks, their drivers, the businesses whose goods they carry, and local garages that
          keep trucks moving.
        </AboutCard>
      </section>

      <section id="contact" className="scroll-mt-20 bg-green-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Contact us</h2>
            <p className="mt-3 text-navy-700">
              Want to see EcoStream on your trucks? Book a demo, or just ask a question. We reply in English, Tamil or Hindi.
            </p>
            <p className="mt-6 flex items-start gap-2 text-navy-700">
              <MapPin size={20} className="mt-0.5 shrink-0 text-green-700" aria-hidden />
              <span>
                <span className="font-semibold text-navy-900">Address:</span> coming soon
                <br />
                Chennai, Tamil Nadu
              </span>
            </p>
          </div>
          <ContactForm />
        </div>
      </section>
    </PublicLayout>
  )
}

function AboutCard({ icon: Icon, title, children }: { icon: typeof Target; title: string; children: string }) {
  return (
    <article className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-navy-900/10">
      <Icon size={30} className="text-green-700" strokeWidth={1.75} aria-hidden />
      <h2 className="mt-3 text-lg font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-navy-700">{children}</p>
    </article>
  )
}

function ContactForm() {
  const [params] = useSearchParams()
  const planName = PLANS.find((p) => p.id === params.get('plan'))?.name
  const startTopic = (TOPICS.find((t) => t.value === params.get('topic'))?.value ?? 'question') as ContactMessage['topic']

  const empty = (): ContactMessage => ({
    name: '',
    phone: '',
    email: '',
    topic: startTopic,
    fleet_size: '',
    message: planName ? `I'm interested in the ${planName} plan.` : '',
  })
  const [form, setForm] = useState<ContactMessage>(empty)
  const [busy, setBusy] = useState(false)
  const [reference, setReference] = useState<string | null>(null)

  // A "Book a demo" link clicked while already on this page: switch the topic.
  useEffect(() => {
    setForm((f) => ({ ...f, topic: startTopic, message: f.message || (planName ? `I'm interested in the ${planName} plan.` : '') }))
  }, [startTopic, planName])

  const set = <K extends keyof ContactMessage>(key: K, value: ContactMessage[K]) => setForm((f) => ({ ...f, [key]: value }))
  const phoneOk = /^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, '').slice(-10))
  const ready = form.name && phoneOk && (form.topic === 'demo' || form.message)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    const { reference } = await submitContact(form)
    setBusy(false)
    setReference(reference)
  }

  if (reference)
    return (
      <div role="status" className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-green-500/30">
        <CheckCircle2 size={36} className="mx-auto text-green-700" aria-hidden />
        <p className="mt-3 font-bold">Thank you, {form.name}.</p>
        <p className="mt-1 text-sm text-navy-700">
          {PUBLIC_FORMS_MOCKED ? `Demo only: nothing was sent. Reference ${reference}.` : `We will get back to you soon. Reference ${reference}.`}
        </p>
        <button type="button" onClick={() => { setForm(empty()); setReference(null) }} className="mt-4 text-sm font-semibold text-green-700 hover:text-green-500">
          Send another message
        </button>
      </div>
    )

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-navy-900/10 sm:p-6">
      <SelectField label="What is it about?" required options={TOPICS} value={form.topic} onChange={(e) => set('topic', e.target.value as ContactMessage['topic'])} />
      <TextField label="Your name" required autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
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
      <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
      {form.topic === 'demo' && (
        <SelectField
          label="How many trucks?"
          options={[
            { value: '', label: 'Choose…' },
            { value: '1-5', label: '1 - 5' },
            { value: '6-20', label: '6 - 20' },
            { value: '21-50', label: '21 - 50' },
            { value: '51-200', label: '51 - 200' },
            { value: '200+', label: 'More than 200' },
          ]}
          value={form.fleet_size}
          onChange={(e) => set('fleet_size', e.target.value)}
        />
      )}
      <TextArea
        label="Message"
        required={form.topic !== 'demo'}
        value={form.message}
        onChange={(e) => set('message', e.target.value)}
      />
      {PUBLIC_FORMS_MOCKED && <DemoFormNote />}
      <button type="submit" disabled={!ready || busy} className={`${primaryButton} w-full`}>
        <Send size={18} aria-hidden /> {busy ? 'Sending…' : form.topic === 'demo' ? 'Request a demo' : 'Send message'}
      </button>
    </form>
  )
}
