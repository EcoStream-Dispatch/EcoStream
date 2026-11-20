import type { AxleConfig, TyreWithStatus } from '../types'
import { AXLE_LAYOUTS } from '../lib/tyreLayout'
import { STATUS_STYLE } from '../lib/status'
import { formatPsi } from '../lib/units'

/*
 * Top view of the truck (front at the top) with each tyre coloured by status.
 * Tap/click a tyre to select it. Works for 6-wheel and 10-wheel layouts
 * (see lib/tyreLayout.ts for the positions).
 *
 * Everything is drawn in an SVG "viewBox" 200 units wide, so it scales to any screen.
 */

const TYRE_W = 18
const TYRE_H = 36
const FRONT_Y = 62 // centre of the front axle
const FIRST_REAR_Y = 150 // centre of the first rear axle
const REAR_GAP = 54 // distance between rear axles

// x (left edge) of each tyre slot. Singles use the inner slots.
const LEFT_OUTER_X = 18
const LEFT_INNER_X = 40
const RIGHT_INNER_X = 142
const RIGHT_OUTER_X = 164

interface Props {
  axleConfig: AxleConfig
  tyres: TyreWithStatus[]
  selectedId: string | null
  onSelect: (tyreId: string) => void
}

export default function TyreLayout({ axleConfig, tyres, selectedId, onSelect }: Props) {
  const axles = AXLE_LAYOUTS[axleConfig]
  const byPosition = new Map(tyres.map((t) => [t.position, t]))
  const axleY = (i: number) => (i === 0 ? FRONT_Y : FIRST_REAR_Y + (i - 1) * REAR_GAP)
  const lastY = axleY(axles.length - 1)
  const height = lastY + TYRE_H / 2 + 22

  /** Draw one tyre at (x, centreY). */
  const drawTyre = (position: string, x: number, cy: number) => {
    const tyre = byPosition.get(position)
    const status = tyre?.status ?? 'offline'
    const style = STATUS_STYLE[status]
    const selected = tyre && tyre.id === selectedId
    const glyph = status === 'warning' || status === 'critical' ? '!' : status === 'offline' ? '–' : ''
    const label = `${position}: ${style.label}${tyre?.latest ? `, ${formatPsi(tyre.latest.pressure_kpa)}` : ''}`

    return (
      <g
        key={position}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-pressed={!!selected}
        className="cursor-pointer outline-none"
        onClick={() => tyre && onSelect(tyre.id)}
        onKeyDown={(e) => {
          if (tyre && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onSelect(tyre.id)
          }
        }}
      >
        <title>{label}</title>
        {selected && (
          <rect
            x={x - 3}
            y={cy - TYRE_H / 2 - 3}
            width={TYRE_W + 6}
            height={TYRE_H + 6}
            rx={6}
            fill="none"
            stroke="#0B1E36"
            strokeWidth={2}
          />
        )}
        <rect x={x} y={cy - TYRE_H / 2} width={TYRE_W} height={TYRE_H} rx={4} fill={style.hex} />
        {/* tread lines */}
        {[-10, -3, 4, 11].map((dy) => (
          <line key={dy} x1={x + 3} x2={x + TYRE_W - 3} y1={cy + dy} y2={cy + dy} stroke="white" strokeOpacity={0.35} />
        ))}
        {glyph && (
          <text x={x + TYRE_W / 2} y={cy + 5} textAnchor="middle" fontSize={14} fontWeight={800} fill="white">
            {glyph}
          </text>
        )}
        <text
          x={x + TYRE_W / 2}
          y={cy + TYRE_H / 2 + 10}
          textAnchor="middle"
          fontSize={7}
          fontWeight={selected ? 700 : 500}
          fill="#0B1E36"
        >
          {position}
        </text>
      </g>
    )
  }

  return (
    <svg
      viewBox={`0 0 200 ${height}`}
      className="mx-auto w-full max-w-[280px]"
      role="group"
      aria-label="Tyre layout, front of truck at the top"
    >
      {/* Cab */}
      <rect x={58} y={6} width={84} height={44} rx={10} fill="#0B1E36" />
      <rect x={66} y={12} width={68} height={12} rx={3} fill="#8CC152" fillOpacity={0.6} />
      <text x={100} y={42} textAnchor="middle" fontSize={7} fill="white" fontWeight={600}>
        FRONT
      </text>
      {/* Cargo body */}
      <rect x={58} y={92} width={84} height={lastY - 92 + 30} rx={4} fill="#F4F9F1" stroke="#1D323A" strokeOpacity={0.2} />
      {/* Chassis rails */}
      <rect x={80} y={50} width={5} height={lastY - 40} fill="#1D323A" fillOpacity={0.5} />
      <rect x={115} y={50} width={5} height={lastY - 40} fill="#1D323A" fillOpacity={0.5} />

      {axles.map((axle, i) => {
        const cy = axleY(i)
        const isDual = axle.left.length === 2
        return (
          <g key={i}>
            {/* Axle bar */}
            <rect x={LEFT_INNER_X + TYRE_W} y={cy - 2} width={RIGHT_INNER_X - LEFT_INNER_X - TYRE_W} height={4} fill="#1D323A" />
            {isDual ? (
              <>
                {drawTyre(axle.left[0], LEFT_OUTER_X, cy)}
                {drawTyre(axle.left[1], LEFT_INNER_X, cy)}
                {drawTyre(axle.right[0], RIGHT_INNER_X, cy)}
                {drawTyre(axle.right[1], RIGHT_OUTER_X, cy)}
              </>
            ) : (
              <>
                {drawTyre(axle.left[0], LEFT_INNER_X, cy)}
                {drawTyre(axle.right[0], RIGHT_INNER_X, cy)}
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}
