import type { DurationModel, RestProfileId, Settings } from './types'

/** Rest profiles chosen by the user (seconds). All are configurable. */
export const DEFAULT_REST_PROFILES: Record<RestProfileId, number> = {
  heavyCompound: 180,
  moderateCompound: 150,
  isolation: 120,
  lightIsolation: 90,
}

/**
 * Engineering estimates for the session-duration model, not training
 * prescriptions. They are editable and should be calibrated against the
 * user's real sessions.
 */
export const DEFAULT_DURATION_MODEL: DurationModel = {
  setSecCompound: 45,
  setSecIsolation: 35,
  loggingSec: 15,
  transitionSec: 90,
  warmupRestSec: 60,
  generalWarmupMin: 5,
}

export function defaultSettings(now = Date.now()): Settings {
  return {
    id: 'singleton',
    trainingDays: [1, 2, 3, 4],
    targetDurationMin: 60,
    restProfiles: { ...DEFAULT_REST_PROFILES },
    minRestSec: 90,
    soundEnabled: true,
    hapticsEnabled: true,
    keepScreenOn: true,
    warmupStartsTimer: false,
    rirTolerance: 1,
    priorities: {
      primary: ['biceps', 'triceps'],
      secondary: ['lateralDelts', 'lats'],
    },
    durationModel: { ...DEFAULT_DURATION_MODEL },
    updatedAt: now,
  }
}

/** Fills fields missing from older stored settings with current defaults. */
export function withSettingsDefaults(stored: Partial<Settings> | undefined): Settings {
  const base = defaultSettings(stored?.updatedAt ?? Date.now())
  if (!stored) return base
  return {
    ...base,
    ...stored,
    restProfiles: { ...base.restProfiles, ...stored.restProfiles },
    priorities: { ...base.priorities, ...stored.priorities },
    durationModel: { ...base.durationModel, ...stored.durationModel },
    id: 'singleton',
  }
}
