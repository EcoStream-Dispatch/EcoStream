import { Link } from 'react-router-dom'
import { STATUS_STYLE } from '../lib/status'
import type { TruckSummary } from '../types'

/*
 * Light "live map" card for the owner dashboard (Stitch: Fleet Command Center map widget).
 * No map library: we draw our corridor (Chennai - Salem - Namakkal) as a line and place
 * each truck by its last GPS position. Good enough for 1-20 trucks on one corridor;
 * swap for a real map (Leaflet/OSM) when trucks run on more routes.
 */

// Box the drawing covers (lat/lon). Trucks outside it are pinned to the edge.
const BOX = { minLat: 11.0, maxLat: 13.3, minLon: 77.8, maxLon: 80.5 }
const W = 600
const H = 340

const TOWNS: { name: string; lat: number; lon: number }[] = [
  { name: 'Chennai', lat: 13.08, lon: 80.27 },
  { name: 'Sriperumbudur', lat: 12.96, lon: 79.95 },
  { name: 'Vellore', lat: 12.92, lon: 79.13 },
  { name: 'Krishnagiri', lat: 12.52, lon: 78.22 },
  { name: 'Dharmapuri', lat: 12.13, lon: 78.16 },
  { name: 'Salem', lat: 11.66, lon: 78.15 },
  { name: 'Namakkal', lat: 11.22, lon: 78.17 },
]

function project(lat: number, lon: number): [number, number] {
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
  const x = ((clamp(lon, BOX.minLon, BOX.maxLon) - BOX.minLon) / (BOX.maxLon - BOX.minLon)) * W
  const y = (1 - (clamp(lat, BOX.minLat, BOX.maxLat) - BOX.minLat) / (BOX.maxLat - BOX.minLat)) * H
  return [x, y]
}

export default function FleetMap({ trucks }: { trucks: TruckSummary[] }) {
  const placed = trucks.filter((t) => t.lat !== null && t.lon !== null)
  const route = TOWNS.map((t) => project(t.lat, t.lon).join(',')).join(' ')

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-green-500/15">
      <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold ring-1 ring-navy-900/10">
        <span className="h-2 w-2 animate-pulse rounded-full bg-critical" aria-hidden /> Last known position
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full bg-green-50" role="img" aria-label="Map of the Chennai to Namakkal corridor with truck positions">
        {/* light grid */}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`v${i}`} x1={(i * W) / 8} y1={0} x2={(i * W) / 8} y2={H} stroke="#0B1E36" strokeOpacity={0.05} />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={(i * H) / 5} x2={W} y2={(i * H) / 5} stroke="#0B1E36" strokeOpacity={0.05} />
        ))}
        {/* highway */}
        <polyline points={route} fill="none" stroke="#8CC152" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.35} />
        <polyline points={route} fill="none" stroke="#3E7231" strokeWidth={2} strokeDasharray="6 6" />
        {TOWNS.map((t) => {
          const [x, y] = project(t.lat, t.lon)
          return (
            <g key={t.name}>
              <circle cx={x} cy={y} r={4} fill="#0B1E36" />
              <text x={x + 8} y={y + 4} fontSize={13} fill="#1D323A" fontFamily="Inter, sans-serif">
                {t.name}
              </text>
            </g>
          )
        })}
        {/* trucks */}
        {placed.map((t) => {
          const [x, y] = project(t.lat!, t.lon!)
          const hex = STATUS_STYLE[t.status].hex
          return (
            <g key={t.id}>
              <circle cx={x} cy={y} r={16} fill={hex} opacity={0.2}>
                <animate attributeName="r" values="10;22;10" dur="2.4s" repeatCount="indefinite" />
              </circle>
              <circle cx={x} cy={y} r={8} fill={hex} stroke="#fff" strokeWidth={3} />
            </g>
          )
        })}
      </svg>
      {/* Legend + links (text, so it's readable and tappable on phones) */}
      <ul className="flex flex-wrap gap-2 border-t border-green-500/15 p-3">
        {placed.length === 0 && <li className="text-sm text-navy-700">No GPS position yet.</li>}
        {placed.map((t) => (
          <li key={t.id}>
            <Link
              to={`/trucks/${t.id}`}
              className="inline-flex min-h-[36px] items-center gap-2 rounded-full bg-green-50 px-3 text-sm font-semibold ring-1 ring-green-500/15 hover:ring-green-500"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_STYLE[t.status].hex }} aria-hidden />
              {t.reg_no}
              <span className="font-normal text-navy-700">· {STATUS_STYLE[t.status].label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
