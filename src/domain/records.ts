import type { SetLog } from './types'

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
