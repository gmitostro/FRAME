import type { SetLog, WorkoutSession } from './types'

/** Personal records from recorded working sets only (no 1RM estimates). */
export interface Records {
  bestLoad: { weightKg: number; reps: number; date: number } | null
  bestSetVolume: { weightKg: number; reps: number; date: number } | null
}

export function computeRecords(history: Array<{ date: number; working: SetLog[] }>): Records {
  let bestLoad: Records['bestLoad'] = null
  let bestSetVolume: Records['bestSetVolume'] = null
  for (const h of history) {
    for (const s of h.working) {
      if (s.reps <= 0) continue
      if (!bestLoad || s.weightKg > bestLoad.weightKg || (s.weightKg === bestLoad.weightKg && s.reps > bestLoad.reps)) {
        bestLoad = { weightKg: s.weightKg, reps: s.reps, date: h.date }
      }
      const vol = s.weightKg * s.reps
      if (!bestSetVolume || vol > bestSetVolume.weightKg * bestSetVolume.reps) {
        bestSetVolume = { weightKg: s.weightKg, reps: s.reps, date: h.date }
      }
    }
  }
  return { bestLoad, bestSetVolume }
}

export interface SessionRecord {
  exerciseId: string
  name: string
  weightKg: number
  reps: number
  previous: { weightKg: number; reps: number }
}

/**
 * Load records set in one session compared with every earlier session:
 * a heavier recorded load, or more reps at the same best load. Exercises
 * done for the first time are not records, and sets flagged for poor
 * technique do not count.
 */
export function sessionRecords(
  session: Pick<WorkoutSession, 'startedAt' | 'exercises'>,
  previousByExercise: Map<string, Array<{ date: number; working: SetLog[] }>>,
): SessionRecord[] {
  const out: SessionRecord[] = []
  const seen = new Set<string>()
  for (const e of session.exercises) {
    if (seen.has(e.exerciseId)) continue
    seen.add(e.exerciseId)
    const today = session.exercises
      .filter((x) => x.exerciseId === e.exerciseId)
      .flatMap((x) => x.sets)
      .filter((x) => x.kind === 'working' && !x.formIssue)
    const best = computeRecords([{ date: session.startedAt, working: today }]).bestLoad
    const prev = computeRecords(previousByExercise.get(e.exerciseId) ?? []).bestLoad
    if (!best || !prev) continue
    if (best.weightKg > prev.weightKg || (best.weightKg === prev.weightKg && best.reps > prev.reps)) {
      out.push({ exerciseId: e.exerciseId, name: e.name, weightKg: best.weightKg, reps: best.reps, previous: { weightKg: prev.weightKg, reps: prev.reps } })
    }
  }
  return out
}
