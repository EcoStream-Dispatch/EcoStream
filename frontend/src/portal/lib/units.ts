/*
 * Unit conversions and the temperature correction from spec section 4.
 * We STORE kPa (gauge) and °C. We SHOW psi and bar.
 */

export const KPA_PER_PSI = 6.894757
export const KPA_PER_BAR = 100

export const kpaToPsi = (kpa: number) => kpa / KPA_PER_PSI
export const kpaToBar = (kpa: number) => kpa / KPA_PER_BAR
export const psiToKpa = (psi: number) => psi * KPA_PER_PSI

/** Atmospheric pressure, kPa. Gauge + this = absolute. */
export const P_ATM_KPA = 101.325
/** Reference temperature for "corrected" pressure: 20 °C in kelvin. */
export const T_REF_K = 293.15

/**
 * Pressure the tyre would have at 20 °C (spec section 4).
 * A hot tyre has higher pressure, but the same corrected pressure,
 * so comparing corrected values tells us if air is really being lost.
 *
 * The real value is computed by the API on ingest. The frontend only uses
 * this to generate believable mock data.
 */
export function correctedKpa(pressureKpa: number, tempC: number): number {
  const pAbs = pressureKpa + P_ATM_KPA
  return pAbs * (T_REF_K / (tempC + 273.15)) - P_ATM_KPA
}

/** The reverse: what the gauge reads at tempC for a given corrected pressure. */
export function gaugeKpaFromCorrected(corrected: number, tempC: number): number {
  return (corrected + P_ATM_KPA) * ((tempC + 273.15) / T_REF_K) - P_ATM_KPA
}

/** "120.4 psi" */
export const formatPsi = (kpa: number) => `${kpaToPsi(kpa).toFixed(1)} psi`
/** "8.30 bar" */
export const formatBar = (kpa: number) => `${kpaToBar(kpa).toFixed(2)} bar`
/** "54.2 °C" */
export const formatTemp = (c: number) => `${c.toFixed(1)} °C`
