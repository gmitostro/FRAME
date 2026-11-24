import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../src/domain/defaults'
import { durationStatus, estimateSession } from '../src/domain/duration'
import type { TemplateExercise } from '../src/domain/types'

const s = defaultSettings(0)
const te = (id: string, exerciseId: string, workingSets: number, warmupSets = 0, restSec: number | null = null): TemplateExercise => ({
  id, exerciseId, workingSets, warmupSets, repMin: 6, repMax: 8, rirTarget: 2, restSec,
})
const lookup = (id: string) =>
  id === 'squat'
    ? { category: 'compound' as const, restProfile: 'heavyCompound' as const }
    : { category: 'isolation' as const, restProfile: 'isolation' as const }

describe('session duration estimate', () => {
  it('is empty for a workout without exercises', () => {
    const e = estimateSession([], lookup, s)
    expect(e.totalSec).toBe(0)
    expect(durationStatus(e.totalSec, 60)).toBe('empty')
  })

  it('builds the estimate from sets, rest, warm-ups and transitions', () => {
    const e = estimateSession([te('a', 'squat', 2, 2)], lookup, s)
    const b = e.exercises[0]
    expect(b.workSec).toBe(2 * (45 + 15))
    expect(b.restSec).toBe(1 * 180) // rest only between working sets
    expect(b.warmupSec).toBe(2 * (45 + 15 + 60))
    expect(b.transitionSec).toBe(90)
    expect(e.totalSec).toBe(5 * 60 + b.totalSec)
  })

  it('respects rest overrides but never goes below the minimum rest', () => {
    const e = estimateSession([te('a', 'curl', 3, 0, 30)], lookup, s)
    expect(e.exercises[0].restSec).toBe(2 * 90)
  })

  it('classifies against the target with a ±5 min band', () => {
    expect(durationStatus(64 * 60, 60)).toBe('onTarget')
    expect(durationStatus(66 * 60, 60)).toBe('over')
    expect(durationStatus(50 * 60, 60)).toBe('under')
  })
})
