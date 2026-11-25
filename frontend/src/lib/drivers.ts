import type { DriverAvailability } from '../types'

/** Label and badge style for each driver availability. */
export const AVAILABILITY: Record<DriverAvailability, { label: string; cls: string }> = {
  available: { label: 'Available', cls: 'bg-green-50 text-green-700 ring-green-500/30' },
  on_duty: { label: 'On duty', cls: 'bg-navy-900 text-white ring-navy-900' },
  off_duty: { label: 'Off duty', cls: 'bg-gray-100 text-gray-600 ring-gray-300' },
}
