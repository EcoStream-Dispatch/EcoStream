import type { TyreStatus } from '../../types'
import { STATUS_STYLE } from '../../lib/status'

/*
 * Map symbols and layer styles, shared by FleetMap (Leaflet) and the legend.
 * Kept apart from FleetMap so pages can show the legend without loading Leaflet.
 */

export type LayerKey = 'garages' | 'dead_zones' | 'ghats' | 'bad_roads'

/** Symbol inside each truck pin, so status is never shown by colour alone. */
export const GLYPH: Record<TyreStatus, string> = { ok: '✓', warning: '!', critical: '✕', offline: '–' }

export const LAYER_STYLE: Record<Exclude<LayerKey, 'garages'>, { color: string; weight: number; dash?: string }> = {
  dead_zones: { color: '#6B7280', weight: 7, dash: '2 8' },
  ghats: { color: '#E0A100', weight: 7 },
  bad_roads: { color: '#C62828', weight: 6, dash: '10 6' },
}

export const LAYER_LABEL: Record<Exclude<LayerKey, 'garages'>, string> = {
  dead_zones: 'No mobile signal',
  ghats: 'Ghat (steep hill road)',
  bad_roads: 'Bad road',
}

/** Legend under a map: status symbols + any layers that are switched on. */
export function MapLegend({ show = {} }: { show?: Partial<Record<LayerKey, boolean>> }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy-700">
      {(['ok', 'warning', 'critical', 'offline'] as TyreStatus[]).map((s) => (
        <li key={s} className="inline-flex items-center gap-1">
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
            style={{ background: STATUS_STYLE[s].hex }}
            aria-hidden
          >
            {GLYPH[s]}
          </span>
          {STATUS_STYLE[s].label}
        </li>
      ))}
      {show.garages && (
        <li className="inline-flex items-center gap-1">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded border-2 border-green-700 text-[9px] font-extrabold text-green-700" aria-hidden>
            G
          </span>
          Garage
        </li>
      )}
      {(['ghats', 'dead_zones', 'bad_roads'] as const).map((k) =>
        show[k] ? (
          <li key={k} className="inline-flex items-center gap-1">
            <svg width="22" height="8" aria-hidden>
              <line
                x1="0"
                y1="4"
                x2="22"
                y2="4"
                stroke={LAYER_STYLE[k].color}
                strokeWidth={4}
                strokeDasharray={LAYER_STYLE[k].dash}
              />
            </svg>
            {LAYER_LABEL[k]}
          </li>
        ) : null,
      )}
    </ul>
  )
}
