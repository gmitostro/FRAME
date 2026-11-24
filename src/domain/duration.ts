import type { DurationModel, Exercise, RestProfileId, Settings, TemplateExercise } from './types'

/**
 * Session duration estimate. Built bottom-up from set time, logging time,
 * exercise-specific rest, warm-up sets and transitions, instead of
 * multiplying sets by a flat number. The constants are estimates (see
 * DEFAULT_DURATION_MODEL) and are shown to the user as approximate.
 */

export interface ExerciseDurationBreakdown {
  templateExerciseId: string
  workSec: number
  restSec: number
  warmupSec: number
  transitionSec: number
  totalSec: number
}

export interface DurationEstimate {
  totalSec: number
  generalWarmupSec: number
  exercises: ExerciseDurationBreakdown[]
}

export function resolveRestSec(
  te: Pick<TemplateExercise, 'restSec'>,
  restProfile: RestProfileId | undefined,
  settings: Pick<Settings, 'restProfiles' | 'minRestSec'>,
): number {
  const base = te.restSec ?? (restProfile ? settings.restProfiles[restProfile] : settings.restProfiles.isolation)
  return Math.max(settings.minRestSec, base)
}

export function estimateExercise(
  te: TemplateExercise,
  ex: Pick<Exercise, 'category' | 'restProfile'> | undefined,
  settings: Pick<Settings, 'restProfiles' | 'minRestSec'>,
  model: DurationModel,
): ExerciseDurationBreakdown {
  const setSec = ex?.category === 'compound' ? model.setSecCompound : model.setSecIsolation
  const rest = resolveRestSec(te, ex?.restProfile, settings)
  const working = Math.max(0, te.workingSets)
  const warmups = Math.max(0, te.warmupSets)
  const workSec = working * (setSec + model.loggingSec)
  // Rest after the last working set is replaced by the transition.
  const restSec = Math.max(0, working - 1) * rest
  const warmupSec = warmups * (setSec + model.loggingSec + model.warmupRestSec)
  const transitionSec = model.transitionSec
  return {
    templateExerciseId: te.id,
    workSec,
    restSec,
    warmupSec,
    transitionSec,
    totalSec: workSec + restSec + warmupSec + transitionSec,
  }
}

export function estimateSession(
  exercises: TemplateExercise[],
  lookup: (exerciseId: string) => Pick<Exercise, 'category' | 'restProfile'> | undefined,
  settings: Pick<Settings, 'restProfiles' | 'minRestSec' | 'durationModel'>,
): DurationEstimate {
  const model = settings.durationModel
  const breakdown = exercises.map((te) => estimateExercise(te, lookup(te.exerciseId), settings, model))
  const generalWarmupSec = exercises.length > 0 ? model.generalWarmupMin * 60 : 0
  const totalSec = generalWarmupSec + breakdown.reduce((sum, b) => sum + b.totalSec, 0)
  return { totalSec, generalWarmupSec, exercises: breakdown }
}

export type DurationStatus = 'empty' | 'under' | 'onTarget' | 'over'

/** Compares with the target; ±5 min counts as on target. */
export function durationStatus(totalSec: number, targetMin: number): DurationStatus {
  if (totalSec <= 0) return 'empty'
  const min = totalSec / 60
  if (min > targetMin + 5) return 'over'
  if (min < targetMin - 5) return 'under'
  return 'onTarget'
}
