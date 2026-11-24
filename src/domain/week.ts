/** Calendar helpers. Training weeks run Monday to Sunday. */

export const DAY_MS = 86_400_000

export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Monday 00:00 of the week containing ts (local time). */
export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts))
  const offset = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - offset)
  return d.getTime()
}

/** Weekdays in display order, Monday first (JS getDay numbers). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

/** Date (00:00) for a weekday in the week that starts at weekStart. */
export function dateOfWeekday(weekStart: number, weekday: number): number {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + ((weekday + 6) % 7))
  return d.getTime()
}

export function sameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b)
}

/** Days from `fromWeekday` to `toWeekday` going forward (0..6). */
export function daysUntil(fromWeekday: number, toWeekday: number): number {
  return (toWeekday - fromWeekday + 7) % 7
}
