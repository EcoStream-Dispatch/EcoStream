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

// ---------- Demo numbers for the story (clearly labelled "demo" on screen) ----------

/** Recommended cold pressure in the demo, psi (830 kPa, the seed value, is about 120 psi). */
export const DEMO_RECOMMENDED_PSI = 120
/** Critical = 80% of recommended (api/alert_config.py). */
export const DEMO_CRITICAL_PSI = DEMO_RECOMMENDED_PSI * 0.8
/** Demo leak: 3 psi per hour (the simulator's --leak scenario). */
export const DEMO_LEAK_PSI_PER_H = 3

/**
 * The slow-leak scene: as you scroll (0..1) we fast-forward 90 minutes of a 3 psi/hour leak.
 * Returns the corrected pressure and the hours left until it is unsafe (below 80%).
 */
export function leakAt(progress: number): { psi: number; hoursLeft: number; minutesShown: number } {
  const elapsedH = 1.5 * Math.min(1, Math.max(0, progress))
  const psi = 110 - DEMO_LEAK_PSI_PER_H * elapsedH
  const hoursLeft = Math.max(0, (psi - DEMO_CRITICAL_PSI) / DEMO_LEAK_PSI_PER_H)
  return { psi, hoursLeft, minutesShown: Math.round(elapsedH * 60) }
}

/** Demo readings shown on the sensor labels (corrected psi, °C). */
export const DEMO_TYRES: Record<string, { psi: number; temp: number }> = {
  FL: { psi: 119.6, temp: 49 },
  FR: { psi: 120.2, temp: 50 },
  'RL-O': { psi: 110, temp: 54 },
  'RL-I': { psi: 119.1, temp: 55 },
  'RR-I': { psi: 120.4, temp: 55 },
  'RR-O': { psi: 119.8, temp: 54 },
}
