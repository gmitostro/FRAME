import type { ProgressionSuggestion } from '../../domain/progression'
import { roundToStep } from '../../domain/progression'
import { warmupSets, workingSets } from '../../domain/session'
import type { SessionExercise, SetKind, SetLog } from '../../domain/types'

/**
 * Values pre-filled in the set logger so the user rarely types: the same
 * set again within the session, otherwise the suggestion, otherwise the
 * last session. Everything stays editable.
 */
export interface LoggerDefaults {
  kind: SetKind
  weightKg: number
  reps: number
  rir: number
}

export function nextKind(ex: SessionExercise): SetKind {
  const warm = warmupSets(ex).length
  const work = workingSets(ex).length
  return work === 0 && warm < ex.prescription.warmupSets ? 'warmup' : 'working'
}

export function loggerDefaults(
  ex: SessionExercise,
  kind: SetKind,
  suggestion: ProgressionSuggestion | null,
  last: { working: SetLog[]; warmup: SetLog[] } | null,
  stepKg: number,
): LoggerDefaults {
  const p = ex.prescription
  const doneWork = workingSets(ex)
  const doneWarm = warmupSets(ex)
  const lastWorkInSession = doneWork.at(-1)
  const rir = lastWorkInSession?.rir ?? p.rirTarget

  const workingWeight = (() => {
    if (lastWorkInSession) return lastWorkInSession.weightKg
    if (suggestion?.kind === 'increase') return suggestion.toKg
    if (suggestion?.kind === 'hold') return suggestion.weightKg
    return last?.working[0]?.weightKg ?? 0
  })()

  if (kind === 'working') {
    const idx = doneWork.length
    const reps = (() => {
      if (lastWorkInSession) return lastWorkInSession.reps
      if (suggestion && suggestion.kind !== 'none') return suggestion.targetReps
      return last?.working[idx]?.reps ?? p.repMin
    })()
    return { kind, weightKg: workingWeight, reps, rir }
  }

  const idx = doneWarm.length
  const prevWarm = doneWarm.at(-1)
  const fromHistory = last?.warmup[idx]
  if (fromHistory) return { kind, weightKg: fromHistory.weightKg, reps: fromHistory.reps, rir }
  if (prevWarm) return { kind, weightKg: prevWarm.weightKg, reps: prevWarm.reps, rir }
  const half = roundToStep(workingWeight * 0.5, stepKg > 0 ? stepKg : 2.5)
  return { kind, weightKg: half, reps: Math.max(p.repMax, 8), rir }
}
