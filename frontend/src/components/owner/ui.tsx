import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, type LucideIcon } from 'lucide-react'
import type { PlanId } from '../../data/plans'
import type { Risk } from '../../types'
import { useLanguage } from '../../i18n/LanguageProvider'

/*
 * Small building blocks shared by the owner portal pages (stage W3).
 */

/** White box with a soft border. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 ${className}`}>{children}</section>
}

/** Section heading inside a card, with an optional right-hand slot (link, tag). */
export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700">{children}</h2>
      {right}
    </div>
  )
}

/** "Demo data" label for anything that comes from sample data (no backend yet). */
export function DemoTag() {
  const { t } = useLanguage()
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-warning/40"
      title="Sample data: not connected to a real backend yet"
    >
      <Info size={12} aria-hidden /> {t('common.demoData')}
    </span>
  )
}

/** Page heading with optional subtitle and right-hand actions. */
export function PageHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-navy-700">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

/** Tiny trend line (no axes). */
export function Sparkline({ values, className = '' }: { values: number[]; className?: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={`h-8 w-full ${className}`} aria-hidden>
      <polyline points={pts} fill="none" stroke="#5C9A35" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Big number tile for the dashboard. */
export function Kpi({
  label,
  value,
  icon: Icon,
  tone = 'navy',
  note,
}: {
  label: string
  value: ReactNode
  icon: LucideIcon
  tone?: 'navy' | 'ok' | 'warning' | 'critical' | 'offline'
  note?: string
}) {
  const toneClass = {
    navy: 'bg-navy-900 text-white',
    ok: 'bg-green-50 text-green-700',
    warning: 'bg-amber-50 text-amber-800',
    critical: 'bg-red-50 text-critical',
    offline: 'bg-gray-100 text-gray-600',
  }[tone]
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200 sm:p-4">
      <span className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg min-[400px]:flex ${toneClass}`}>
        <Icon size={20} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="break-words font-heading text-xl font-extrabold leading-tight sm:text-2xl">{value}</p>
        <p className="text-xs font-semibold text-navy-700">{label}</p>
        {note && <p className="text-[11px] text-navy-700/80">{note}</p>}
      </div>
    </div>
  )
}

const PLAN_STYLE: Record<PlanId, string> = {
  lite: 'bg-green-50 text-green-700 ring-green-500/30',
  pro: 'bg-navy-900 text-white ring-navy-900',
  fleet: 'bg-green-700 text-white ring-green-700',
}

/** Plan badge: LITE / PRO / FLEET. */
export function PlanBadge({ plan }: { plan: PlanId }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 font-heading text-[11px] font-bold uppercase tracking-wide ring-1 ${PLAN_STYLE[plan]}`}>
      {plan}
    </span>
  )
}

const RISK_STYLE: Record<Risk, { label: string; icon: LucideIcon; cls: string }> = {
  low: { label: 'Low', icon: CheckCircle2, cls: 'bg-green-50 text-green-700 ring-green-500/30' },
  medium: { label: 'Medium', icon: AlertTriangle, cls: 'bg-amber-50 text-amber-800 ring-warning/40' },
  high: { label: 'High', icon: OctagonAlert, cls: 'bg-red-50 text-critical ring-critical/30' },
}

/** Risk pill with icon + word. */
export function RiskBadge({ risk }: { risk: Risk }) {
  const { label, icon: Icon, cls } = RISK_STYLE[risk]
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${cls}`}>
      <Icon size={14} aria-hidden /> {label} risk
    </span>
  )
}

export const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

/** "in 3 days" / "3 days ago" / "today" for a YYYY-MM-DD date. */
export function daysFromNow(date: string, now = new Date()): number {
  const d = new Date(`${date}T00:00:00`)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

export function dueText(date: string): string {
  const n = daysFromNow(date)
  if (n === 0) return 'today'
  if (n < 0) return `${-n} day${n === -1 ? '' : 's'} overdue`
  return `in ${n} day${n === 1 ? '' : 's'}`
}

export function formatDate(date: string): string {
  return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
