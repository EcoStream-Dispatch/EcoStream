import type { Plan } from '../types'
import { PLAN_NAME } from '../lib/plans'

const STYLE: Record<Plan, string> = {
  lite: 'bg-green-50 text-green-700 ring-green-500/30',
  pro: 'bg-navy-900 text-white ring-navy-900',
  fleet: 'bg-green-700 text-white ring-green-700',
}

/** Small "LITE / PRO / FLEET" plan tag for truck cards and headers. */
export default function PlanBadge({ plan, className = '' }: { plan: Plan; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider ring-1 ${STYLE[plan]} ${className}`}
      title={`${PLAN_NAME[plan]} plan`}
    >
      {PLAN_NAME[plan]}
    </span>
  )
}
