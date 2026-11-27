import type { Exercise, LoadType, Prescription, SetLog } from './types'

/**
 * Double progression [STR-35]: keep the load until every prescribed working
 * set reaches the top of the rep range at the target RIR, then add load and
 * return toward the bottom of the range. Load step 2-10%, smaller for
 * upper-body and small-muscle exercises [STR-13]. If reported RIR is clearly
 * lower than planned, hold the load [STR-30, STR-32]. The engine only
 * suggests; it never changes a prescription by itself.
 *
 * Assisted exercises log the machine assistance, so progressing means
 * LESS weight: the reference is the most assisted set (the easiest one),
 * and the step removes assistance by the equipment increment, never below
 * zero. A percentage of the assistance says nothing about the load moved
 * (body minus assistance, body weight unknown), so pct is null there.
 * Engineering choice, not evidence: see TRAINING_SYSTEM.md.
 */

export type HoldReason =
  | 'buildReps'
  | 'rirBelowTarget'
  | 'formIssue'
  | 'incompleteSets'
  | 'repsBelowMin'
  /** Assisted exercise already done with zero assistance. */
  | 'noAssistanceLeft'

export type ProgressionSuggestion =
  | { kind: 'none'; reason: 'noHistory' }
  | {
      kind: 'increase'
      fromKg: number
      toKg: number
      /** Always positive; for assisted exercises it is removed, not added. */
      stepKg: number
      /** True for assisted exercises: toKg = fromKg - stepKg (less help, harder). */
      reducesAssistance: boolean
      /** Fraction (0.025 = 2.5%); null for bodyweight-only and assisted exercises. */
      pct: number | null
      /** True when the equipment step exceeds the 10% upper bound. */
      stepAboveRange: boolean
      targetReps: number
    }
  | { kind: 'hold'; weightKg: number; targetReps: number; reason: HoldReason }

export interface ProgressionInput {
  prescription: Pick<Prescription, 'workingSets' | 'repMin' | 'repMax' | 'rirTarget'>
  /** Working sets from the most recent session with this exercise. */
  lastWorkingSets: SetLog[]
  /** loadType must be the resolved one (loadProfile), not the raw field. */
  exercise: Pick<Exercise, 'loadStepKg' | 'lowerBody' | 'category'> & { loadType?: LoadType }
  rirTolerance: number
}

const SMALL_STEP = 0.025
const LARGE_STEP = 0.05
const MAX_STEP = 0.1

export function roundToStep(value: number, step: number): number {
  if (step <= 0) return value
  return Math.round(value / step) * step
}

/** Smallest equipment-compatible increment that is at least the target %. */
export function loadIncrement(currentKg: number, ex: ProgressionInput['exercise']): number {
  const step = ex.loadStepKg > 0 ? ex.loadStepKg : 2.5
  if (currentKg <= 0) return step
  const pct = ex.lowerBody && ex.category === 'compound' ? LARGE_STEP : SMALL_STEP
  const raw = currentKg * pct
  return Math.max(step, Math.ceil(raw / step - 1e-9) * step)
}

export function suggestProgression(input: ProgressionInput): ProgressionSuggestion {
  const { prescription: p, exercise, rirTolerance } = input
  const sets = input.lastWorkingSets.filter((s) => s.kind === 'working')
  if (sets.length === 0) return { kind: 'none', reason: 'noHistory' }

  const assisted = exercise.loadType === 'assisted'
  // Conservative reference: the easiest set (least load, or most assistance).
  const weights = sets.map((s) => s.weightKg)
  const refKg = assisted ? Math.max(...weights) : Math.min(...weights)
  const minReps = Math.min(...sets.map((s) => s.reps))
  const nextReps = Math.min(p.repMax, minReps + 1)

  if (sets.some((s) => s.formIssue)) {
    return { kind: 'hold', weightKg: refKg, targetReps: Math.max(p.repMin, minReps), reason: 'formIssue' }
  }
  if (sets.length < p.workingSets) {
    return { kind: 'hold', weightKg: refKg, targetReps: Math.max(p.repMin, nextReps), reason: 'incompleteSets' }
  }
  if (minReps < p.repMin) {
    return { kind: 'hold', weightKg: refKg, targetReps: p.repMin, reason: 'repsBelowMin' }
  }
  if (minReps < p.repMax) {
    return { kind: 'hold', weightKg: refKg, targetReps: nextReps, reason: 'buildReps' }
  }
  const rirTooLow = sets.some((s) => s.rir !== null && s.rir < p.rirTarget - rirTolerance)
  if (rirTooLow) {
    return { kind: 'hold', weightKg: refKg, targetReps: p.repMax, reason: 'rirBelowTarget' }
  }

  if (assisted) {
    if (refKg <= 0) {
      return { kind: 'hold', weightKg: 0, targetReps: p.repMax, reason: 'noAssistanceLeft' }
    }
    const step = exercise.loadStepKg > 0 ? exercise.loadStepKg : 2.5
    const toKg = Math.max(0, refKg - step)
    return {
      kind: 'increase',
      fromKg: refKg,
      toKg,
      stepKg: refKg - toKg,
      reducesAssistance: true,
      pct: null,
      stepAboveRange: false,
      targetReps: p.repMin,
    }
  }

  const stepKg = loadIncrement(refKg, exercise)
  const pct = refKg > 0 ? stepKg / refKg : null
  return {
    kind: 'increase',
    fromKg: refKg,
    toKg: refKg + stepKg,
    stepKg,
    reducesAssistance: false,
    pct,
    stepAboveRange: pct !== null && pct > MAX_STEP + 1e-9,
    targetReps: p.repMin,
  }
}
