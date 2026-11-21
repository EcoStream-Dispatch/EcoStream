import type { AxleConfig } from '../types'

/*
 * Which tyre positions each truck layout has, axle by axle, front to back.
 * Read it like looking DOWN on the truck, front at the top.
 *
 *   left:  outer -> inner
 *   right: inner -> outer
 *
 * Position names:
 *   F = front, R = rear, T = trailer, L/R = left/right, O/I = outer/inner of a dual pair.
 *   6W uses the names from the spec: FL, FR, RL-O, RL-I, RR-I, RR-O.
 *   More than one axle of a kind: numbered, e.g. F1L, F2L (twin steer), R1L-O ... R3R-O, T1L-O.
 *
 * Must match what the sensors are registered as in the `tyres` table.
 */
export type AxleGroup = 'front' | 'rear' | 'trailer'

export interface Axle {
  group: AxleGroup
  left: string[]
  right: string[]
}

const single = (group: AxleGroup, name: string): Axle => ({ group, left: [`${name}L`], right: [`${name}R`] })
const dual = (group: AxleGroup, name: string): Axle => ({
  group,
  left: [`${name}L-O`, `${name}L-I`],
  right: [`${name}R-I`, `${name}R-O`],
})

export const AXLE_LAYOUTS: Record<AxleConfig, Axle[]> = {
  '6W': [single('front', 'F'), dual('rear', 'R')],
  '10W': [single('front', 'F'), dual('rear', 'R1'), dual('rear', 'R2')],
  '12W': [single('front', 'F1'), single('front', 'F2'), dual('rear', 'R1'), dual('rear', 'R2')],
  '14W': [single('front', 'F'), dual('rear', 'R1'), dual('rear', 'R2'), dual('rear', 'R3')],
  '18W': [single('front', 'F'), dual('rear', 'R1'), dual('rear', 'R2'), dual('trailer', 'T1'), dual('trailer', 'T2')],
}

export const AXLE_CONFIG_LABEL: Record<AxleConfig, string> = {
  '6W': '6-wheel',
  '10W': '10-wheel',
  '12W': '12-wheel (twin steer)',
  '14W': '14-wheel',
  '18W': '18-wheel (tractor-trailer)',
}

/** All positions for a layout, in display order. */
export function positionsFor(config: AxleConfig): string[] {
  return AXLE_LAYOUTS[config].flatMap((a) => [...a.left, ...a.right])
}

/** Human name for a position: "RL-O" -> "Rear left, outer", "T2R-I" -> "Trailer axle 2 right, inner" */
export function positionName(pos: string): string {
  const m = pos.match(/^([FRT])(\d?)(L|R)(?:-(O|I))?$/)
  if (!m) return pos
  const [, kind, num, side, dualPos] = m
  const base = kind === 'F' ? 'Front' : kind === 'R' ? 'Rear' : 'Trailer'
  const axleName = num ? `${base} axle ${num}` : base
  const sideName = side === 'L' ? 'left' : 'right'
  const dualName = dualPos === 'O' ? ', outer' : dualPos === 'I' ? ', inner' : ''
  return `${axleName} ${sideName}${dualName}`
}
