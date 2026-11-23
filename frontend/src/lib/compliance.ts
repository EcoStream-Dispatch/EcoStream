import type { ComplianceKind } from '../types'

/* Compliance reminders: permit, fitness certificate, PUC and insurance due dates. */

export const COMPLIANCE_NAME: Record<ComplianceKind, string> = {
  permit: 'Permit',
  fitness: 'Fitness certificate',
  puc: 'PUC (pollution) certificate',
  insurance: 'Insurance',
}

/** Show "due soon" this many days before the due date. */
export const DUE_SOON_DAYS = 30

export type DueState = 'overdue' | 'due_soon' | 'ok'

/** Today's date in India as "YYYY-MM-DD". */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)
}

/** Whole days from today (IST) to a "YYYY-MM-DD" date. Negative = in the past. */
export function daysUntil(date: string, now: Date = new Date()): number {
  const day = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
  return Math.round((day(date) - day(todayIST(now))) / 86_400_000)
}

export function dueState(date: string, now: Date = new Date()): DueState {
  const d = daysUntil(date, now)
  if (d < 0) return 'overdue'
  if (d <= DUE_SOON_DAYS) return 'due_soon'
  return 'ok'
}

/** "Overdue by 5 days" / "Due in 12 days" / "Due today" */
export function dueText(date: string, now: Date = new Date()): string {
  const d = daysUntil(date, now)
  if (d === 0) return 'Due today'
  if (d < 0) return `Overdue by ${-d} day${d === -1 ? '' : 's'}`
  return `Due in ${d} day${d === 1 ? '' : 's'}`
}

/** "23 Dec 2026" */
export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
