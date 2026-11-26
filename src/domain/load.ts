import type { Exercise, LoadBasis, LoadProfile, LoadType } from './types'

/**
 * Load classification of the built-in library. Kept in code (not stored)
 * so corrections reach existing installs; a user edit stores explicit
 * fields on the exercise, which then take precedence.
 */
export const LIBRARY_LOAD_OVERRIDES: Record<string, Partial<LoadProfile>> = {
  'puxada-unilateral': { unilateral: true },
  'remada-unilateral': { unilateral: true },
  'remada-serrote': { unilateral: true },
  'triceps-unilateral-polia': { unilateral: true },
  'rosca-concentrada': { unilateral: true },
  'rosca-alternada': { unilateral: true },
  'elevacao-lateral-polia': { unilateral: true },
  'agachamento-bulgaro': { unilateral: true },
  afundo: { unilateral: true },
  'roda-abdominal': { loadType: 'none' },
}

function defaultLoadType(ex: Pick<Exercise, 'equipment'>): LoadType {
  if (ex.equipment === 'bodyweight') return 'bodyweight'
  if (ex.equipment === 'band') return 'none'
  return 'external'
}

function defaultLoadBasis(ex: Pick<Exercise, 'equipment'>): LoadBasis {
  return ex.equipment === 'dumbbell' || ex.equipment === 'kettlebell' ? 'perDumbbell' : 'total'
}

/** Effective classification: explicit fields, then library, then equipment. */
export function loadProfile(ex: Pick<Exercise, 'id' | 'equipment' | 'loadType' | 'loadBasis' | 'unilateral' | 'measure'>): LoadProfile {
  const lib = LIBRARY_LOAD_OVERRIDES[ex.id] ?? {}
  return {
    loadType: ex.loadType ?? lib.loadType ?? defaultLoadType(ex),
    loadBasis: ex.loadBasis ?? lib.loadBasis ?? defaultLoadBasis(ex),
    unilateral: ex.unilateral ?? lib.unilateral ?? false,
    measure: ex.measure ?? lib.measure ?? 'reps',
  }
}

/** Which caption describes the logged weight. */
export type WeightMeaning = 'total' | 'perDumbbell' | 'perSide' | 'added' | 'assistance' | 'none'

export function weightMeaning(p: LoadProfile): WeightMeaning {
  if (p.loadType === 'none') return 'none'
  if (p.loadType === 'bodyweight') return 'added'
  if (p.loadType === 'assisted') return 'assistance'
  return p.loadBasis
}
