import type { Equipment, ExerciseCategory, LoadBasis, LoadType, Measure, MovementPattern, MuscleGroup, RestProfileId } from '../domain/types'
import { ptBR, type Dictionary } from './pt-BR'

/** Dotted paths to string leaves of the dictionary, checked at compile time. */
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : T[K] extends readonly string[] ? never : Leaves<T[K], `${P}${K}.`>
}[keyof T & string]

export type MessageKey = Leaves<Dictionary>

const dict: Dictionary = ptBR
export const LOCALE = 'pt-BR'

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let node: unknown = dict
  for (const part of key.split('.')) node = (node as Record<string, unknown>)[part]
  let out = typeof node === 'string' ? node : key
  if (params) for (const [k, v] of Object.entries(params)) out = out.replaceAll(`{${k}}`, String(v))
  return out
}

export const muscleLabel = (m: MuscleGroup) => dict.muscles[m]
export const equipmentLabel = (e: Equipment) => dict.equipment[e]
export const patternLabel = (p: MovementPattern) => dict.patterns[p]
export const categoryLabel = (c: ExerciseCategory) => dict.categories[c]
export const restProfileLabel = (r: RestProfileId) => dict.restProfiles[r]
export const loadTypeLabel = (l: LoadType) => dict.exercises.loadTypes[l]
export const loadBasisLabel = (b: LoadBasis) => dict.exercises.loadBases[b]
export const measureLabel = (m: Measure) => dict.exercises.measures[m]
export const volumeHowLines = (): readonly string[] => dict.volume.how
export const weekdayLong = (d: number) => dict.weekdays.long[d] ?? ''
export const weekdayShort = (d: number) => dict.weekdays.short[d] ?? ''
export const weekdayInitial = (d: number) => dict.weekdays.initial[d] ?? ''
export const weekdayOnDay = (d: number) => dict.weekdays.onDay[d] ?? ''

// ---------- Formatting (pt-BR: comma decimals, DD/MM/YYYY, 24 h) ----------

const kgFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 })
const intFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })
const pctFmt = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 1 })

export const formatNumber = (n: number) => kgFmt.format(n)
export const formatInt = (n: number) => intFmt.format(n)
export const formatKg = (n: number) => `${kgFmt.format(n)} kg`
export const formatPct = (fraction: number) => pctFmt.format(fraction)

/** Parses user input with comma or dot decimals. */
export function parseDecimal(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const p2 = (n: number) => String(n).padStart(2, '0')

export function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function formatShortDate(ts: number): string {
  const d = new Date(ts)
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`
}

/** 3:05 for timers (minutes:seconds); 1:02:05 past an hour. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${p2(m)}:${p2(s)}` : `${m}:${p2(s)}`
}

/** "58 min", "1 h 05 min" for durations. */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} min`
  return `${h} h ${p2(m)} min`
}

/** Rest values: "3:00", "1:30". */
export const formatRest = (sec: number) => formatClock(sec * 1000)
