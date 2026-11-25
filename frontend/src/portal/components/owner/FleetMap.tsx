import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Garage, MapLayers, TruckSummary, TyreStatus } from '../../types'
export type { LayerKey } from './mapStyle'
import { STATUS_STYLE, truckHealth } from '../../lib/status'
import { GLYPH, LAYER_LABEL, LAYER_STYLE, type LayerKey } from './mapStyle'

/*
 * Map of trucks (and optionally garages and route-risk layers), using Leaflet with
 * free OpenStreetMap tiles: no paid map key. Loaded lazily, so pages without a map
 * don't download Leaflet.
 *
 * Status is never colour alone: each pin has a symbol (✓ ! ✕ –) and a tooltip with the word.
 * OpenStreetMap's tile servers are fine for a prototype; for real traffic we should use a
 * tile provider with a usage plan (OSM tile usage policy).
 */


function truckIcon(status: TyreStatus, label: string, selected: boolean) {
  const color = STATUS_STYLE[status].hex
  return L.divIcon({
    className: '',
    // Wide enough for the pin AND its label, anchored on the pin's centre.
    iconSize: [80, 30],
    iconAnchor: [15, 15],
    html: `<div style="display:flex;align-items:center;gap:3px;white-space:nowrap">
      <span style="flex:none;box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:${color};color:#fff;font:800 15px Inter,sans-serif;border:${selected ? '3px solid #0B1E36' : '2px solid #fff'};box-shadow:0 1px 4px rgba(0,0,0,.35)">${GLYPH[status]}</span>
      <span style="background:#fff;color:#0B1E36;font:700 11px Inter,sans-serif;padding:1px 4px;border-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.25)">${label}</span>
    </div>`,
  })
}

const garageIcon = L.divIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:5px;background:#fff;color:#3E7231;font:800 12px Montserrat,sans-serif;border:2px solid #3E7231">G</span>`,
})

/** Zoom the map to fit all points once they arrive (and when the set of points changes). */
function FitTo({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join(';')
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 10)
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 11 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

interface Props {
  trucks: TruckSummary[]
  garages?: Garage[]
  layers?: MapLayers
  show?: Partial<Record<LayerKey, boolean>>
  /** A planned route to draw (e.g. sender -> receiver) */
  route?: [number, number][]
  selectedId?: string | null
  onSelect?: (truckId: string) => void
  className?: string
}

export default function FleetMap({ trucks, garages = [], layers, show = {}, route, selectedId, onSelect, className = 'h-80' }: Props) {
  const placed = useMemo(() => trucks.filter((t) => t.lat != null && t.lon != null), [trucks])
  const fitPoints = useMemo<[number, number][]>(
    () => [...placed.map((t) => [t.lat!, t.lon!] as [number, number]), ...(route ?? [])],
    [placed, route],
  )

  return (
    // `isolate` keeps Leaflet's own z-index values inside the map, below our menus.
    <div className={`isolate overflow-hidden rounded-lg ring-1 ring-gray-200 ${className}`}>
      <MapContainer center={[12.4, 78.9]} zoom={8} scrollWheelZoom={false} className="h-full w-full" attributionControl>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={18}
        />
        <FitTo points={fitPoints} />

        {route && route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#0B1E36', weight: 4, opacity: 0.6, dashArray: '6 6' }} />}

        {layers &&
          (['dead_zones', 'ghats', 'bad_roads'] as const).map((k) =>
            show[k]
              ? layers[k].map((path) => (
                  <Polyline
                    key={`${k}-${path.name}`}
                    positions={path.points}
                    pathOptions={{ color: LAYER_STYLE[k].color, weight: LAYER_STYLE[k].weight, opacity: 0.75, dashArray: LAYER_STYLE[k].dash }}
                  >
                    <Tooltip sticky>
                      <strong>{LAYER_LABEL[k]}</strong>
                      <br />
                      {path.name}
                    </Tooltip>
                  </Polyline>
                ))
              : null,
          )}

        {show.garages &&
          garages.map((g) => (
            <Marker key={g.id} position={[g.lat, g.lon]} icon={garageIcon} title={`Garage: ${g.name}`}>
              <Tooltip>
                <strong>{g.name}</strong>
                <br />
                {g.verified ? 'Verified' : 'Not verified yet'} · {g.open_24x7 ? 'Open 24x7' : `${g.opens}-${g.closes}`}
              </Tooltip>
            </Marker>
          ))}

        {placed.map((t) => {
          const status = truckHealth(t)
          return (
            <Marker
              key={t.id}
              position={[t.lat!, t.lon!]}
              icon={truckIcon(status, t.reg_no.slice(-4), t.id === selectedId)}
              title={`${t.reg_no}: ${STATUS_STYLE[status].label}`}
              zIndexOffset={t.id === selectedId ? 3000 : status === 'critical' ? 2000 : 1000} // trucks always above garage markers
              eventHandlers={onSelect ? { click: () => onSelect(t.id) } : undefined}
            >
              <Tooltip direction="top" offset={[0, -14]}>
                <strong>{t.reg_no}</strong> · {STATUS_STYLE[status].label}
              </Tooltip>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
