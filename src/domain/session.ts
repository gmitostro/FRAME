import { resolveRestSec } from './duration'
import * as T from './timer'
import type {
  Exercise,
  SessionExercise,
  SetKind,
  SetLog,
  Settings,
  WorkoutSession,
  WorkoutTemplate,
} from './types'

/**
 * Pure state transitions for a live workout. The repository persists the
 * returned object after every call, so nothing lives only in memory.
 */

export type IdFn = () => string

export function buildSession(
  template: WorkoutTemplate,
  lookup: (id: string) => Exercise | undefined,
  settings: Pick<Settings, 'restProfiles' | 'minRestSec'>,
  now: number,
  newId: IdFn,
): WorkoutSession {
  const exercises: SessionExercise[] = template.exercises.map((te) => {
    const ex = lookup(te.exerciseId)
    return {
      id: newId(),
      exerciseId: te.exerciseId,
      name: ex?.namePt ?? '—',
      prescription: {
        workingSets: te.workingSets,
        warmupSets: te.warmupSets,
        repMin: te.repMin,
        repMax: te.repMax,
        rirTarget: te.rirTarget,
        restSec: resolveRestSec(te, ex?.restProfile, settings),
      },
      status: 'pending',
      sets: [],
      notes: te.notes,
    }
  })
  return {
    id: newId(),
    programId: template.programId,
    templateId: template.id,
    templateName: template.name,
    status: 'active',
    startedAt: now,
    endedAt: null,
    pausedAt: null,
    pausedMs: 0,
    currentIndex: 0,
    exercises,
    exerciseIds: unique(exercises.map((e) => e.exerciseId)),
    restTimer: null,
    updatedAt: now,
  }
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)]
}

function touch(s: WorkoutSession, now: number): WorkoutSession {
  return { ...s, exerciseIds: unique(s.exercises.map((e) => e.exerciseId)), updatedAt: now }
}

function replaceExercise(s: WorkoutSession, index: number, ex: SessionExercise): SessionExercise[] {
  return s.exercises.map((e, i) => (i === index ? ex : e))
}

export function workingSets(ex: SessionExercise): SetLog[] {
  return ex.sets.filter((x) => x.kind === 'working')
}

export function warmupSets(ex: SessionExercise): SetLog[] {
  return ex.sets.filter((x) => x.kind === 'warmup')
}

export function isExerciseComplete(ex: SessionExercise): boolean {
  return workingSets(ex).length >= ex.prescription.workingSets
}

export interface SetInput {
  kind: SetKind
  weightKg: number
  reps: number
  rir: number | null
  formIssue?: boolean
}

export function sanitizeSetInput(input: SetInput): SetInput {
  const weightKg = Number.isFinite(input.weightKg) ? Math.max(0, Math.round(input.weightKg * 100) / 100) : 0
  const reps = Number.isFinite(input.reps) ? Math.max(0, Math.min(999, Math.round(input.reps))) : 0
  const rir = input.rir === null || !Number.isFinite(input.rir) ? null : Math.max(0, Math.min(10, Math.round(input.rir)))
  return { ...input, weightKg, reps, rir }
}

/** Active workout time, excluding pauses. */
export function sessionElapsedMs(s: WorkoutSession, now: number): number {
  // While paused, the clock stops at pausedAt; finished pauses are in pausedMs.
  const end = s.endedAt ?? s.pausedAt ?? now
  return Math.max(0, end - s.startedAt - s.pausedMs)
}

export function addSet(
  s: WorkoutSession,
  index: number,
  raw: SetInput,
  now: number,
  newId: IdFn,
  opts: { warmupStartsTimer: boolean },
): WorkoutSession {
  const ex = s.exercises[index]
  if (!ex) return s
  const input = sanitizeSetInput(raw)
  const prevWorking = workingSets(ex).at(-1)
  let restBeforeSec: number | null = null
  if (input.kind === 'working' && prevWorking) {
    restBeforeSec = Math.max(0, Math.round((now - prevWorking.completedAt) / 1000))
  }
  const set: SetLog = {
    id: newId(),
    kind: input.kind,
    weightKg: input.weightKg,
    reps: input.reps,
    rir: input.kind === 'working' ? input.rir : null,
    formIssue: input.formIssue || undefined,
    completedAt: now,
    restBeforeSec,
  }
  const sets = [...ex.sets, set]
  const updated: SessionExercise = { ...ex, sets }
  updated.status = isExerciseComplete(updated) ? 'done' : 'pending'

  const startTimer = input.kind === 'working' || opts.warmupStartsTimer
  const restTimer = startTimer
    ? T.startTimer(now, input.kind === 'working' ? ex.prescription.restSec : 60, ex.id, set.id)
    : s.restTimer
  return touch({ ...s, exercises: replaceExercise(s, index, updated), restTimer, currentIndex: index }, now)
}

export function updateSet(
  s: WorkoutSession,
  index: number,
  setId: string,
  patch: Partial<SetInput>,
  now: number,
): WorkoutSession {
  const ex = s.exercises[index]
  if (!ex) return s
  const sets = ex.sets.map((x) => {
    if (x.id !== setId) return x
    const merged = sanitizeSetInput({
      kind: patch.kind ?? x.kind,
      weightKg: patch.weightKg ?? x.weightKg,
      reps: patch.reps ?? x.reps,
      rir: patch.rir !== undefined ? patch.rir : x.rir,
      formIssue: patch.formIssue ?? x.formIssue,
    })
    return {
      ...x,
      kind: merged.kind,
      weightKg: merged.weightKg,
      reps: merged.reps,
      rir: merged.kind === 'working' ? merged.rir : null,
      formIssue: merged.formIssue || undefined,
    }
  })
  const updated: SessionExercise = { ...ex, sets }
  if (updated.status !== 'skipped') updated.status = isExerciseComplete(updated) ? 'done' : 'pending'
  return touch({ ...s, exercises: replaceExercise(s, index, updated) }, now)
}

export function removeSet(s: WorkoutSession, index: number, setId: string, now: number): WorkoutSession {
  const ex = s.exercises[index]
  if (!ex) return s
  const updated: SessionExercise = { ...ex, sets: ex.sets.filter((x) => x.id !== setId) }
  if (updated.status !== 'skipped') updated.status = isExerciseComplete(updated) ? 'done' : 'pending'
  const restTimer = s.restTimer?.setId === setId ? null : s.restTimer
  return touch({ ...s, exercises: replaceExercise(s, index, updated), restTimer }, now)
}

export function nextPendingIndex(s: WorkoutSession, from: number): number | null {
  const n = s.exercises.length
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n
    if (s.exercises[i]?.status === 'pending') return i
  }
  return null
}

export function setCurrent(s: WorkoutSession, index: number, now: number): WorkoutSession {
  if (index < 0 || index >= s.exercises.length) return s
  return { ...s, currentIndex: index, updatedAt: now }
}

export function skipExercise(s: WorkoutSession, index: number, now: number): WorkoutSession {
  const ex = s.exercises[index]
  if (!ex) return s
  const exercises = replaceExercise(s, index, { ...ex, status: 'skipped' })
  const next = { ...s, exercises }
  const target = nextPendingIndex(next, index)
  return touch({ ...next, currentIndex: target ?? index }, now)
}

export function unskipExercise(s: WorkoutSession, index: number, now: number): WorkoutSession {
  const ex = s.exercises[index]
  if (!ex) return s
  const status = isExerciseComplete(ex) ? 'done' : 'pending'
  return touch({ ...s, exercises: replaceExercise(s, index, { ...ex, status }), currentIndex: index }, now)
}

/**
 * Replaces an exercise. With no sets logged the entry is swapped in place;
 * with sets already logged, those stay with the original exercise and the
 * substitute is inserted next with the remaining working sets.
 */
export function substituteExercise(
  s: WorkoutSession,
  index: number,
  replacement: Exercise,
  now: number,
  newId: IdFn,
  settings: Pick<Settings, 'restProfiles' | 'minRestSec'>,
): WorkoutSession {
  const ex = s.exercises[index]
  if (!ex || replacement.id === ex.exerciseId) return s
  const restSec = Math.max(settings.minRestSec, settings.restProfiles[replacement.restProfile])
  const done = workingSets(ex).length
  if (ex.sets.length === 0) {
    const swapped: SessionExercise = {
      ...ex,
      exerciseId: replacement.id,
      name: replacement.namePt,
      substitutedFor: ex.substitutedFor ?? { exerciseId: ex.exerciseId, name: ex.name },
      prescription: { ...ex.prescription, restSec },
    }
    return touch({ ...s, exercises: replaceExercise(s, index, swapped), currentIndex: index }, now)
  }
  const remaining = Math.max(1, ex.prescription.workingSets - done)
  const inserted: SessionExercise = {
    id: newId(),
    exerciseId: replacement.id,
    name: replacement.namePt,
    substitutedFor: { exerciseId: ex.exerciseId, name: ex.name },
    prescription: { ...ex.prescription, workingSets: remaining, warmupSets: 0, restSec },
    status: 'pending',
    sets: [],
  }
  const closed: SessionExercise = { ...ex, status: done > 0 ? 'done' : 'skipped' }
  const exercises = [...s.exercises.slice(0, index), closed, inserted, ...s.exercises.slice(index + 1)]
  return touch({ ...s, exercises, currentIndex: index + 1 }, now)
}

export function addExerciseToSession(
  s: WorkoutSession,
  exercise: Exercise,
  now: number,
  newId: IdFn,
  settings: Pick<Settings, 'restProfiles' | 'minRestSec'>,
): WorkoutSession {
  const entry: SessionExercise = {
    id: newId(),
    exerciseId: exercise.id,
    name: exercise.namePt,
    prescription: {
      workingSets: 2,
      warmupSets: 0,
      repMin: 6,
      repMax: 10,
      rirTarget: 2,
      restSec: Math.max(settings.minRestSec, settings.restProfiles[exercise.restProfile]),
    },
    status: 'pending',
    sets: [],
  }
  const exercises = [...s.exercises, entry]
  return touch({ ...s, exercises, currentIndex: exercises.length - 1 }, now)
}

export function setExerciseNotes(s: WorkoutSession, index: number, notes: string, now: number): WorkoutSession {
  const ex = s.exercises[index]
  if (!ex) return s
  return touch({ ...s, exercises: replaceExercise(s, index, { ...ex, notes }) }, now)
}

export function pauseSession(s: WorkoutSession, now: number): WorkoutSession {
  if (s.pausedAt !== null) return s
  return {
    ...s,
    pausedAt: now,
    restTimer: s.restTimer ? T.pauseTimer(s.restTimer, now) : null,
    updatedAt: now,
  }
}

export function resumeSession(s: WorkoutSession, now: number): WorkoutSession {
  if (s.pausedAt === null) return s
  const delta = Math.max(0, now - s.pausedAt)
  return {
    ...s,
    pausedAt: null,
    pausedMs: s.pausedMs + delta,
    restTimer: s.restTimer ? T.resumeTimer(s.restTimer, now) : null,
    updatedAt: now,
  }
}

export type TimerAction =
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'extend'; sec: number }
  | { type: 'dismiss' }
  | { type: 'markAlerted' }

export function applyTimerAction(s: WorkoutSession, action: TimerAction, now: number): WorkoutSession {
  const t = s.restTimer
  if (!t) return s
  let next: typeof t | null = t
  switch (action.type) {
    case 'pause':
      next = T.pauseTimer(t, now)
      break
    case 'resume':
      next = T.resumeTimer(t, now)
      break
    case 'restart':
      next = T.restartTimer(t, now)
      break
    case 'extend':
      next = T.extendTimer(t, now, action.sec)
      break
    case 'dismiss':
      next = null
      break
    case 'markAlerted':
      next = { ...t, alerted: true }
      break
  }
  return { ...s, restTimer: next, updatedAt: now }
}

export function finishSession(s: WorkoutSession, now: number): WorkoutSession {
  const resumed = resumeSession(s, now)
  const exercises = resumed.exercises.map((e) =>
    e.status === 'pending' && e.sets.length === 0 ? { ...e, status: 'skipped' as const } : e,
  )
  return touch({ ...resumed, exercises, status: 'completed', endedAt: now, restTimer: null }, now)
}

export function discardSession(s: WorkoutSession, now: number): WorkoutSession {
  return { ...s, status: 'discarded', endedAt: now, restTimer: null, updatedAt: now }
}

export interface SessionSummary {
  durationMs: number
  workingSets: number
  warmupSets: number
  exercisesDone: number
  exercisesSkipped: number
  /** Sum of load x reps on working sets (kg). */
  tonnageKg: number
}

export function summarize(s: WorkoutSession, now: number): SessionSummary {
  let working = 0
  let warm = 0
  let tonnage = 0
  for (const e of s.exercises) {
    for (const set of e.sets) {
      if (set.kind === 'working') {
        working++
        tonnage += set.weightKg * set.reps
      } else warm++
    }
  }
  return {
    durationMs: sessionElapsedMs(s, now),
    workingSets: working,
    warmupSets: warm,
    exercisesDone: s.exercises.filter((e) => e.sets.some((x) => x.kind === 'working')).length,
    exercisesSkipped: s.exercises.filter((e) => e.status === 'skipped').length,
    tonnageKg: Math.round(tonnage),
  }
}
