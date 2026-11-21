import type { AxleConfig, TyreWithStatus } from '../types'
import { AXLE_LAYOUTS } from '../lib/tyreLayout'
import { STATUS_STYLE } from '../lib/status'
import { formatPsi } from '../lib/units'

/*
 * Top view of the truck (front at the top) with each tyre coloured by status.
 * Tap/click a tyre to select it. Works for 6, 10, 12, 14 and 18-wheel layouts
 * (see lib/tyreLayout.ts for the positions).
 *
 * Everything is drawn in an SVG "viewBox" 200 units wide, so it scales to any screen.
 */

const TYRE_W = 18
const TYRE_H = 36
const FRONT_Y = 62 // centre of the first front axle
const AXLE_GAP = 58 // distance between axles of the same group (room for the labels)
const GROUP_GAP = 88 // distance from the last axle of one group to the first of the next
const BODY_TOP = 92 // where the cargo body starts

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
  // y of each axle: small gaps inside a group (front / rear / trailer), bigger gaps between groups.
  const ys: number[] = []
  axles.forEach((a, i) => {
    if (i === 0) ys.push(FRONT_Y)
    else ys.push(ys[i - 1] + (a.group === axles[i - 1].group ? AXLE_GAP : GROUP_GAP))
  })
  const axleY = (i: number) => ys[i]
  const lastY = ys[ys.length - 1]
  // Tractor-trailer: where the trailer starts (between the last rear axle and the first trailer axle).
  const trailerIdx = axles.findIndex((a) => a.group === 'trailer')
  const hitchY = trailerIdx > 0 ? (ys[trailerIdx - 1] + ys[trailerIdx]) / 2 : null
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
      {/* Cargo body (and trailer, drawn as a second box after the hitch) */}
      {hitchY === null ? (
        <rect x={58} y={BODY_TOP} width={84} height={lastY - BODY_TOP + 30} rx={4} fill="#F4F9F1" stroke="#1D323A" strokeOpacity={0.2} />
      ) : (
        <>
          <rect x={58} y={BODY_TOP} width={84} height={hitchY - BODY_TOP - 8} rx={4} fill="#F4F9F1" stroke="#1D323A" strokeOpacity={0.2} />
          <rect x={52} y={hitchY + 4} width={96} height={lastY - hitchY + 26} rx={4} fill="#F4F9F1" stroke="#1D323A" strokeOpacity={0.35} />
          <circle cx={100} cy={hitchY} r={5} fill="#1D323A" />
          <text x={100} y={hitchY + 16} textAnchor="middle" fontSize={7} fill="#1D323A" fontWeight={600}>
            TRAILER
          </text>
        </>
      )}
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
