import { weightMeaning } from '../../domain/load'
import type { LoadProfile } from '../../domain/types'
import { t, type MessageKey } from '../../i18n'

const WEIGHT_KEYS: Record<string, MessageKey> = {
  total: 'workout.weightTotal',
  perDumbbell: 'workout.weightPerDumbbell',
  perSide: 'workout.weightPerSide',
  added: 'workout.weightAdded',
  assistance: 'workout.weightAssistance',
}

/** What the weight and reps fields mean for this exercise (null = no weight field). */
export function loadCaptions(profile: LoadProfile): { weight: string | null; reps: string } {
  const meaning = weightMeaning(profile)
  return {
    weight: meaning === 'none' ? null : t(WEIGHT_KEYS[meaning]),
    reps: profile.unilateral ? t('workout.repsPerSide') : t('workout.reps'),
  }
}
