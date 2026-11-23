/*
 * Tiny shared state between the HTML story (scroll) and the 3D scene.
 * Plain mutable object on purpose: the scene reads it every frame in useFrame,
 * so it must not trigger React re-renders.
 */

/** Story sections, top to bottom. Each one has a progress value from 0 to 1. */
export const SECTIONS = ['hero', 'xray', 'leak', 'hotleak', 'journey', 'map', 'finale'] as const
export type SectionId = (typeof SECTIONS)[number]

export const story = {
  /** 0..1 while scrolling through each section (0 before it, 1 after it) */
  progress: Object.fromEntries(SECTIONS.map((s) => [s, 0])) as Record<SectionId, number>,
  /** Pointer / device tilt, -1..1 on each axis, for the camera parallax */
  pointer: { x: 0, y: 0 },
  /** Set when the story has scrolled out of view, so the scene can pause */
  visible: true,
  /** Lighter effects on phones and low-power devices */
  lowPower: false,
}

/** Smoothstep between edges a and b. */
export function ease(t: number, a = 0, b = 1): number {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

/** Linear interpolation. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Rough check for phones and low-power devices. */
export function detectLowPower(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  const small = window.matchMedia('(max-width: 768px)').matches
  const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4
  return small || weak || !!nav.connection?.saveData
}

/** True when the browser can draw WebGL. */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}
