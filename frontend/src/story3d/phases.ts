import { ease, story } from '../landing3d/store'

/** Scene blend values derived from the scroll progress of each chapter (read every frame). */
export function phases() {
  const p = story.progress
  const xray = ease(p.xray, 0.08, 0.4) * (1 - ease(p.hotleak, 0.0, 0.25))
  const leak = ease(p.leak, 0.06, 0.3) * (1 - ease(p.hotleak, 0.0, 0.2))
  const hot = ease(p.hotleak, 0.05, 0.25) * (1 - ease(p.journey, 0.0, 0.2))
  const cab = ease(p.journey, 0.04, 0.25) * (1 - ease(p.map, 0.0, 0.25))
  const stream = ease(p.journey, 0.15, 0.85)
  const map = ease(p.map, 0.1, 0.4) * (1 - ease(p.finale, 0.0, 0.3))
  const drive = ease(p.finale, 0.05, 0.6)
  return { xray, leak, hot, cab, stream, map, drive }
}

/** Fixed positions (three.js, metres) of things the chapters point at. Truck faces -Z. */
export const SPOTS = {
  wheelRadius: 0.522,
  sensorFL: [-1.03, 0.62, -3.0] as [number, number, number],
  leakWheel: [-1.03, 0.522, 1.6] as [number, number, number],
  cabUnit: [0.42, 2.25, -3.92] as [number, number, number],
  tower: [16, 0, -44] as [number, number, number],
  standA: [0.35, 0, -7.8] as [number, number, number],
  standB: [0.35, 0, -10.6] as [number, number, number],
  garageFront: -22,
  driveTo: -15.5,
}
