import { formatBar, formatPsi } from '../lib/units'

/** Shows a kPa value as psi (big) and bar (small). */
export default function Pressure({ kpa, className = '' }: { kpa: number; className?: string }) {
  return (
    <span className={className}>
      <span className="font-semibold">{formatPsi(kpa)}</span>
      <span className="ml-1 text-sm text-navy-700">· {formatBar(kpa)}</span>
    </span>
  )
}
