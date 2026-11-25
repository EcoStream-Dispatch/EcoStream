import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Mail, MessageCircle, Smartphone, UserPlus } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { addTeamUser, getSettings, getTeam, saveSettings } from '../../services/api'
import { Card, CardTitle, DemoTag, PageHeader } from '../../components/owner/ui'
import LanguageSwitch from '../../components/LanguageSwitch'
import { ErrorBox, Loading } from '../../components/PageState'
import { useLanguage } from '../../i18n/LanguageProvider'
import type { AlertThresholds, NotificationSettings, TeamUser } from '../../types'

/*
 * Settings (docs/WEBSITE_SPEC.md section 2.13): users and roles (owner, manager, viewer),
 * alert thresholds, notification channels (WhatsApp, SMS, email), language.
 *
 * Demo: saved in this browser tab only. The real alert thresholds live in
 * api/alert_config.py; making them editable per owner needs a backend change.
 * No WhatsApp / SMS / email is sent yet.
 */

const ROLE_HELP: Record<TeamUser['role'], string> = {
  owner: 'Everything, including plans and billing',
  manager: 'Trucks, alerts, shipments, drivers',
  viewer: 'Can look, cannot change anything',
}

export default function SettingsPage() {
  const { t } = useLanguage()
  const teamQ = useApi(getTeam, [])
  const settingsQ = useApi(getSettings, [])

  if ((teamQ.loading && !teamQ.data) || (settingsQ.loading && !settingsQ.data)) return <Loading what="settings" />
  if (teamQ.error || settingsQ.error) return <ErrorBox message={(teamQ.error ?? settingsQ.error)!} />

  return (
    <>
      <PageHeader title={t('owner.settings')} right={<DemoTag />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TeamCard team={teamQ.data ?? []} onAdded={teamQ.reload} />
        {settingsQ.data && <AlertsAndChannels initial={settingsQ.data} />}
        <Card>
          <CardTitle>{t('nav.language')}</CardTitle>
          <p className="mb-2 text-sm text-navy-700">Language for this app on this device. Tamil and Hindi cover menus, login, alerts and status words for now.</p>
          <LanguageSwitch />
        </Card>
      </div>
    </>
  )
}

function TeamCard({ team, onAdded }: { team: TeamUser[]; onAdded: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamUser['role']>('manager')
  const [done, setDone] = useState<string | null>(null)
  const ok = name.trim() && /^\S+@\S+\.\S+$/.test(email)

  async function invite(e: FormEvent) {
    e.preventDefault()
    if (!ok) return
    await addTeamUser({ name: name.trim(), email: email.trim(), role })
    setDone(`${name.trim()} added as ${role}. (Demo: no invite email sent.)`)
    setName('')
    setEmail('')
    onAdded()
  }

  return (
    <Card>
      <CardTitle>Users and roles</CardTitle>
      <ul className="divide-y divide-gray-100">
        {team.map((u) => (
          <li key={u.id} className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span className="min-w-0">
              <span className="block truncate font-semibold">{u.name}</span>
              <span className="block truncate text-xs text-navy-700">{u.email}</span>
            </span>
            <span className="shrink-0 sm:text-right">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold capitalize">{u.role}</span>
              <span className="ml-2 text-[11px] text-navy-700 sm:mt-0.5 sm:ml-0 sm:block">{ROLE_HELP[u.role]}</span>
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={invite} className="mt-3 grid gap-2 border-t border-gray-100 pt-3 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input aria-label="Name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        <input aria-label="Email" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as TeamUser['role'])} className={inputCls}>
          <option value="manager">Manager</option>
          <option value="viewer">Viewer</option>
        </select>
        <button type="submit" disabled={!ok} className="inline-flex items-center justify-center gap-1 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <UserPlus size={16} aria-hidden /> Add
        </button>
      </form>
      {done && (
        <p role="status" className="mt-2 text-sm text-green-700">
          {done}
        </p>
      )}
    </Card>
  )
}

function AlertsAndChannels({ initial }: { initial: { thresholds: AlertThresholds; notifications: NotificationSettings } }) {
  const [th, setTh] = useState(initial.thresholds)
  const [nt, setNt] = useState(initial.notifications)
  const [saved, setSaved] = useState(false)
  useEffect(() => setSaved(false), [th, nt])
  const valid = th.critical_pressure_pct < th.low_pressure_pct && th.low_pressure_pct <= 100 && th.critical_pressure_pct >= 50 && th.max_temp_c >= 60 && th.max_temp_c <= 120 && th.leak_warning_psi_per_hour > 0

  const num = (k: keyof AlertThresholds) => (e: React.ChangeEvent<HTMLInputElement>) => setTh({ ...th, [k]: Number(e.target.value) })

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    await saveSettings(th, nt)
    setSaved(true)
  }

  return (
    <form onSubmit={save} className="space-y-4 lg:row-span-2">
      <Card>
        <CardTitle>Alert thresholds</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumField label="Low pressure warning below" unit="% of recommended" value={th.low_pressure_pct} onChange={num('low_pressure_pct')} />
          <NumField label="Critical pressure below" unit="% of recommended" value={th.critical_pressure_pct} onChange={num('critical_pressure_pct')} />
          <NumField label="Tyre too hot above" unit="°C" value={th.max_temp_c} onChange={num('max_temp_c')} />
          <NumField label="Slow leak warning from" unit="psi per hour" value={th.leak_warning_psi_per_hour} step={0.5} onChange={num('leak_warning_psi_per_hour')} />
        </div>
        {!valid && <p className="mt-2 text-sm text-critical">Critical must be below the warning level (50-100 %), temperature 60-120 °C.</p>}
        <p className="mt-2 text-xs text-navy-700">Starting values match the alert logic in the API (api/alert_config.py). Changing them here is demo only for now.</p>
      </Card>

      <Card>
        <CardTitle>Notification channels</CardTitle>
        <div className="space-y-2">
          <Toggle icon={MessageCircle} label="WhatsApp" on={nt.whatsapp} onChange={(v) => setNt({ ...nt, whatsapp: v })} />
          <Toggle icon={Smartphone} label="SMS" on={nt.sms} onChange={(v) => setNt({ ...nt, sms: v })} />
          <Toggle icon={Mail} label="Email" on={nt.email} onChange={(v) => setNt({ ...nt, email: v })} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-semibold">Mobile for WhatsApp / SMS</span>
            <input type="tel" value={nt.phone} onChange={(e) => setNt({ ...nt, phone: e.target.value })} className={`${inputCls} mt-1 w-full`} />
          </label>
          <label className="text-sm">
            <span className="font-semibold">Email</span>
            <input type="email" value={nt.email_address} onChange={(e) => setNt({ ...nt, email_address: e.target.value })} className={`${inputCls} mt-1 w-full`} />
          </label>
        </div>
        <p className="mt-2 text-xs text-navy-700">No messages are sent yet: WhatsApp and SMS alerts are a later phase.</p>
      </Card>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={!valid} className="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-500 disabled:opacity-50">
          Save settings
        </button>
        {saved && (
          <span role="status" className="inline-flex items-center gap-1 text-sm text-green-700">
            <CheckCircle2 size={16} aria-hidden /> Saved (demo: this browser tab only)
          </span>
        )}
      </div>
    </form>
  )
}

const inputCls = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 sm:text-sm'

function NumField({ label, unit, value, step = 1, onChange }: { label: string; unit: string; value: number; step?: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="block text-sm">
      <span className="font-semibold">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <input type="number" inputMode="decimal" step={step} value={value} onChange={onChange} className={`${inputCls} w-24`} />
        <span className="text-xs text-navy-700">{unit}</span>
      </span>
    </label>
  )
}

function Toggle({ icon: Icon, label, on, onChange }: { icon: typeof Mail; label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 ring-1 ring-gray-200">
      <span className="inline-flex items-center gap-2 text-sm font-semibold">
        <Icon size={18} className="text-green-700" aria-hidden /> {label}
      </span>
      <span className="inline-flex items-center gap-2 text-xs font-semibold">
        {on ? 'On' : 'Off'}
        <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-green-700" />
      </span>
    </label>
  )
}
