/*
 * Tiny shared state between the HTML story (scroll) and the 3D scene.
 * Plain mutable object on purpose: the scene reads it every frame in useFrame,
 * so it must not trigger React re-renders.
 */

/** Story sections, top to bottom. Each one has a progress value from 0 to 1. */
export const SECTIONS = ['hero', 'xray', 'leak', 'hotleak', 'journey', 'map', 'pillars', 'roles', 'finale'] as const
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

// ---------- Hot vs leak (same correction as api/alert_logic.py, in psi) ----------

const P_ATM_PSI = 14.696
const T_REF_K = 293.15

/** Corrected (20 °C) pressure from gauge pressure and tyre temperature, psi. */
export function correctedPsi(gaugePsi: number, tempC: number): number {
  return (gaugePsi + P_ATM_PSI) * (T_REF_K / (tempC + 273.15)) - P_ATM_PSI
}
/** Gauge pressure a tyre shows at tempC for a given corrected pressure, psi. */
export function gaugePsi(corrected: number, tempC: number): number {
  return (corrected + P_ATM_PSI) * ((tempC + 273.15) / T_REF_K) - P_ATM_PSI
}

/** Heat slider value chosen by the visitor (null = follow the scroll). */
export const heatState = { user: null as number | null }

/** 0..1 drive / heat amount for the hot-vs-leak scene. */
export function heatNow(): number {
  return heatState.user ?? ease(story.progress.hotleak, 0.12, 0.8)
}

export interface HotLeakTyre {
  temp: number
  gauge: number
  corrected: number
}

/**
 * The two demo tyres at drive/heat amount h (0..1 = 0..2 hours of driving).
 * Both heat from 30 °C to 85 °C. The hot tyre keeps its air; the leaking one loses 3 psi/hour.
 */
export function hotLeakAt(h: number): { hot: HotLeakTyre; leak: HotLeakTyre; minutes: number; alert: boolean } {
  const temp = 30 + 55 * (1 - Math.exp(-h * 2.6)) / (1 - Math.exp(-2.6))
  const hours = 2 * h
  const hotC = DEMO_RECOMMENDED_PSI
  const leakC = DEMO_RECOMMENDED_PSI - DEMO_LEAK_PSI_PER_H * hours
  return {
    hot: { temp, corrected: hotC, gauge: gaugePsi(hotC, temp) },
    leak: { temp, corrected: leakC, gauge: gaugePsi(leakC, temp) },
    minutes: Math.round(hours * 60),
    // slow_leak needs a clear downward slope over at least ~10-15 min of readings (api/alert_logic.py)
    alert: hours >= 0.25,
  }
}

/** 1 while driving, easing to 0 as the truck pulls up at the garage in the finale. */
export function driveFactor(): number {
  return 1 - ease(story.progress.finale, 0.1, 0.55)
}

/** 0 = golden evening, 1 = bright morning (the finale's sunrise). */
export function dayFactor(): number {
  return ease(story.progress.finale, 0.0, 0.6)
}
