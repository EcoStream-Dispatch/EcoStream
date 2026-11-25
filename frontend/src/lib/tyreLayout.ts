import type { AxleConfig } from '../types'

/*
 * Which tyre positions each truck layout has, axle by axle, front to back.
 * Read it like looking DOWN on the truck, front at the top.
 *
 *   left:  outer -> inner
 *   right: inner -> outer
 *
 * Position names:
 *   F = front, R = rear, L/R = left/right, O/I = outer/inner of a dual pair.
 *   6W uses the names from the spec: FL, FR, RL-O, RL-I, RR-I, RR-O.
 *   10W has two rear axles, so they are numbered: R1L-O ... R2R-O.
 */
export interface Axle {
  left: string[]
  right: string[]
}

export const AXLE_LAYOUTS: Record<AxleConfig, Axle[]> = {
  '6W': [
    { left: ['FL'], right: ['FR'] },
    { left: ['RL-O', 'RL-I'], right: ['RR-I', 'RR-O'] },
  ],
  '10W': [
    { left: ['FL'], right: ['FR'] },
    { left: ['R1L-O', 'R1L-I'], right: ['R1R-I', 'R1R-O'] },
    { left: ['R2L-O', 'R2L-I'], right: ['R2R-I', 'R2R-O'] },
  ],
}

/** All positions for a layout, in display order. */
export function positionsFor(config: AxleConfig): string[] {
  return AXLE_LAYOUTS[config].flatMap((a) => [...a.left, ...a.right])
}

/** Human name for a position: "RL-O" -> "Rear left, outer" */
export function positionName(pos: string): string {
  const m = pos.match(/^(F|R\d?)(L|R)(?:-(O|I))?$/)
  if (!m) return pos
  const [, axle, side, dual] = m
  const axleName = axle === 'F' ? 'Front' : axle === 'R' ? 'Rear' : `Rear axle ${axle.slice(1)}`
  const sideName = side === 'L' ? 'left' : 'right'
  const dualName = dual === 'O' ? ', outer' : dual === 'I' ? ', inner' : ''
  return `${axleName} ${sideName}${dualName}`
}
