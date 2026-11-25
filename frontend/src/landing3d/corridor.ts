/*
 * The pilot corridor (Chennai - Krishnagiri - Salem - Namakkal): real town positions,
 * the highway and the demo garages. Shared by the 3D map and the photo page's map.
 */

export const TOWNS: { name: string; lat: number; lon: number; big?: boolean }[] = [
  { name: 'Chennai', lat: 13.08, lon: 80.27, big: true },
  { name: 'Vellore', lat: 12.92, lon: 79.13 },
  { name: 'Krishnagiri', lat: 12.52, lon: 78.22, big: true },
  { name: 'Dharmapuri', lat: 12.13, lon: 78.16 },
  { name: 'Salem', lat: 11.66, lon: 78.15, big: true },
  { name: 'Namakkal', lat: 11.22, lon: 78.17, big: true },
]

/** The highway, town to town (NH 48 to Krishnagiri, then NH 44 south). */
export const ROUTE: [number, number][] = [
  [13.08, 80.27],
  [12.97, 79.94],
  [12.92, 79.13],
  [12.68, 78.62],
  [12.52, 78.22],
  [12.13, 78.16],
  [11.95, 78.13],
  [11.66, 78.15],
  [11.45, 78.18],
  [11.22, 78.17],
]

/** Demo garages (same positions as the app's demo data, "Sample Tyre Works 1-13"). */
export const GARAGES: [number, number][] = [
  [13.0475, 80.096],
  [12.961, 79.955],
  [12.93, 79.64],
  [12.923, 79.333],
  [12.92, 79.14],
  [12.79, 78.716],
  [12.64, 78.49],
  [12.52, 78.22],
  [12.13, 78.16],
  [11.95, 78.13],
  [11.67, 78.14],
  [11.45, 78.18],
  [11.22, 78.17],
]
