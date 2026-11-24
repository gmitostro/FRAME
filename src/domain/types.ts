/**
 * Core data model for FRAME.
 *
 * Pure types only: no React, no storage. Every persisted record carries
 * timestamps (epoch ms) so history can be reconstructed and migrated.
 */

export const MUSCLE_GROUPS = [
  'chest',
  'lats',
  'upperBack',
  'traps',
  'frontDelts',
  'lateralDelts',
  'rearDelts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'lowerBack',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'calves',
] as const
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export const EQUIPMENT = [
  'barbell',
  'ezBar',
  'dumbbell',
  'machine',
  'cable',
  'smith',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
] as const
export type Equipment = (typeof EQUIPMENT)[number]

export const MOVEMENT_PATTERNS = [
  'horizontalPush',
  'verticalPush',
  'horizontalPull',
  'verticalPull',
  'squat',
  'lunge',
  'hinge',
  'hipExtension',
  'kneeExtension',
  'kneeFlexion',
  'elbowFlexion',
  'elbowExtension',
  'shoulderAbduction',
  'shoulderExtension',
  'fly',
  'rearDeltFly',
  'shrug',
  'calfRaise',
  'coreFlexion',
  'antiExtension',
  'hipAbduction',
  'hipAdduction',
  'other',
] as const
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number]

export const EXERCISE_CATEGORIES = ['compound', 'isolation'] as const
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number]

export const REST_PROFILES = ['heavyCompound', 'moderateCompound', 'isolation', 'lightIsolation'] as const
export type RestProfileId = (typeof REST_PROFILES)[number]

export interface Exercise {
  id: string
  namePt: string
  nameEn?: string
  primaryMuscle: MuscleGroup
  secondaryMuscles: MuscleGroup[]
  equipment: Equipment
  pattern: MovementPattern
  category: ExerciseCategory
  restProfile: RestProfileId
  /** Smallest practical load increment on this equipment, in kg. */
  loadStepKg: number
  /** Lower-body multi-joint lifts use the larger progression step. */
  lowerBody: boolean
  cues?: string[]
  commonMistakes?: string[]
  notes?: string
  isCustom: boolean
  archived?: boolean
  createdAt: number
  updatedAt: number
}

export interface Program {
  id: string
  name: string
  isActive: boolean
  createdAt: number
  updatedAt: number
}

export interface TemplateExercise {
  id: string
  exerciseId: string
  workingSets: number
  warmupSets: number
  repMin: number
  repMax: number
  rirTarget: number
  /** Overrides the exercise's rest profile when set (seconds). */
  restSec: number | null
  notes?: string
}

export interface WorkoutTemplate {
  id: string
  programId: string
  name: string
  /** 0 = Sunday ... 6 = Saturday (JS Date#getDay); null = unscheduled. */
  weekday: number | null
  order: number
  notes?: string
  warmupNotes?: string
  exercises: TemplateExercise[]
  createdAt: number
  updatedAt: number
}

export type SetKind = 'warmup' | 'working'

export interface SetLog {
  id: string
  kind: SetKind
  weightKg: number
  reps: number
  /** Reps in reserve reported by the user; null when not recorded. */
  rir: number | null
  /** User flagged poor technique / momentum: excluded from progression. */
  formIssue?: boolean
  completedAt: number
  /** Actual rest since the previous working set of the same exercise (s). */
  restBeforeSec: number | null
}

export interface Prescription {
  workingSets: number
  warmupSets: number
  repMin: number
  repMax: number
  rirTarget: number
  restSec: number
}

export type SessionExerciseStatus = 'pending' | 'done' | 'skipped'

export interface SessionExercise {
  id: string
  exerciseId: string
  /** Snapshot so history survives later edits or deletions. */
  name: string
  /** Set when this entry replaced another exercise during the session. */
  substitutedFor?: { exerciseId: string; name: string }
  prescription: Prescription
  status: SessionExerciseStatus
  sets: SetLog[]
  notes?: string
}

export interface RestTimerState {
  startedAt: number
  durationMs: number
  pausedAt: number | null
  pausedMs: number
  /** SessionExercise id the timer belongs to. */
  exerciseRef: string
  /** Set id that started the timer. */
  setId: string
  alerted: boolean
}

export type SessionStatus = 'active' | 'completed' | 'discarded'

export interface WorkoutSession {
  id: string
  programId: string | null
  templateId: string | null
  templateName: string
  status: SessionStatus
  startedAt: number
  endedAt: number | null
  pausedAt: number | null
  pausedMs: number
  currentIndex: number
  exercises: SessionExercise[]
  /** Denormalised for the multi-entry index (exercise history queries). */
  exerciseIds: string[]
  restTimer: RestTimerState | null
  notes?: string
  updatedAt: number
}

export interface DurationModel {
  /** Seconds a working set takes, by category. */
  setSecCompound: number
  setSecIsolation: number
  /** Seconds spent logging each set. */
  loggingSec: number
  /** Seconds to walk to and set up the next exercise. */
  transitionSec: number
  /** Rest after each warm-up set. */
  warmupRestSec: number
  /** General warm-up at the start of the session (minutes). */
  generalWarmupMin: number
}

export interface Settings {
  id: 'singleton'
  /** 0 = Sunday ... 6 = Saturday. */
  trainingDays: number[]
  targetDurationMin: number
  restProfiles: Record<RestProfileId, number>
  minRestSec: number
  soundEnabled: boolean
  hapticsEnabled: boolean
  keepScreenOn: boolean
  warmupStartsTimer: boolean
  /** Accepted gap between reported and target RIR for a load increase. */
  rirTolerance: number
  priorities: { primary: MuscleGroup[]; secondary: MuscleGroup[] }
  durationModel: DurationModel
  updatedAt: number
}
