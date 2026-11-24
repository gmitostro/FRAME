import { describe, expect, it } from 'vitest'
import type { SessionExercise, SetLog } from '../src/domain/types'
import { loggerDefaults, nextKind } from '../src/features/workout/prefill'

const set = (kind: SetLog['kind'], weightKg: number, reps: number, rir: number | null = 2): SetLog => ({
  id: Math.random().toString(36), kind, weightKg, reps, rir, completedAt: 0, restBeforeSec: null,
})
const ex = (sets: SetLog[], warmupSets = 2): SessionExercise => ({
  id: 'e', exerciseId: 'x', name: 'X', status: 'pending', sets,
  prescription: { workingSets: 2, warmupSets, repMin: 6, repMax: 10, rirTarget: 2, restSec: 180 },
})

describe('set logger pre-fill', () => {
  it('starts with warm-ups when prescribed, then working sets', () => {
    expect(nextKind(ex([]))).toBe('warmup')
    expect(nextKind(ex([set('warmup', 40, 8), set('warmup', 60, 5)]))).toBe('working')
    expect(nextKind(ex([], 0))).toBe('working')
  })

  it('uses the previous session warm-ups and the suggested load', () => {
    const last = { working: [set('working', 80, 10), set('working', 80, 10)], warmup: [set('warmup', 40, 10), set('warmup', 60, 6)] }
    const suggestion = { kind: 'increase' as const, fromKg: 80, toKg: 82.5, stepKg: 2.5, pct: 0.031, stepAboveRange: false, targetReps: 6 }
    expect(loggerDefaults(ex([]), 'warmup', suggestion, last, 2.5)).toMatchObject({ weightKg: 40, reps: 10 })
    expect(loggerDefaults(ex([set('warmup', 40, 10)]), 'warmup', suggestion, last, 2.5)).toMatchObject({ weightKg: 60, reps: 6 })
    expect(loggerDefaults(ex([]), 'working', suggestion, last, 2.5)).toMatchObject({ weightKg: 82.5, reps: 6, rir: 2 })
  })

  it('repeats the last working set of this session', () => {
    const cur = ex([set('working', 85, 7, 1)])
    expect(loggerDefaults(cur, 'working', null, null, 2.5)).toMatchObject({ weightKg: 85, reps: 7, rir: 1 })
  })

  it('falls back to zero load and the bottom of the range with no history', () => {
    expect(loggerDefaults(ex([], 0), 'working', { kind: 'none', reason: 'noHistory' }, null, 2.5)).toMatchObject({ weightKg: 0, reps: 6, rir: 2 })
  })
})
