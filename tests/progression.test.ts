import { describe, expect, it } from 'vitest'
import { loadIncrement, suggestProgression } from '../src/domain/progression'
import type { SetLog } from '../src/domain/types'

const set = (weightKg: number, reps: number, rir: number | null = 2, extra: Partial<SetLog> = {}): SetLog => ({
  id: Math.random().toString(36),
  kind: 'working',
  weightKg,
  reps,
  rir,
  completedAt: 0,
  restBeforeSec: null,
  ...extra,
})
const presc = { workingSets: 2, repMin: 6, repMax: 8, rirTarget: 2 }
const upper = { loadStepKg: 2, lowerBody: false, category: 'isolation' as const }
const lowerCompound = { loadStepKg: 2.5, lowerBody: true, category: 'compound' as const }

describe('double progression', () => {
  it('has no suggestion without history', () => {
    expect(suggestProgression({ prescription: presc, lastWorkingSets: [], exercise: upper, rirTolerance: 1 }).kind).toBe('none')
  })

  it('holds load and asks for one more rep while building reps', () => {
    const r = suggestProgression({ prescription: presc, lastWorkingSets: [set(30, 7), set(30, 6)], exercise: upper, rirTolerance: 1 })
    expect(r).toMatchObject({ kind: 'hold', reason: 'buildReps', weightKg: 30, targetReps: 7 })
  })

  it('increases load when every set hits the top of the range at target RIR', () => {
    const r = suggestProgression({ prescription: presc, lastWorkingSets: [set(30, 8, 2), set(30, 8, 2)], exercise: upper, rirTolerance: 1 })
    expect(r).toMatchObject({ kind: 'increase', fromKg: 30, toKg: 32, stepKg: 2, targetReps: 6 })
  })

  it('holds when reps were reached closer to failure than planned', () => {
    const r = suggestProgression({ prescription: presc, lastWorkingSets: [set(30, 8, 2), set(30, 8, 0)], exercise: upper, rirTolerance: 1 })
    expect(r).toMatchObject({ kind: 'hold', reason: 'rirBelowTarget' })
  })

  it('accepts RIR within the tolerance', () => {
    const r = suggestProgression({ prescription: presc, lastWorkingSets: [set(30, 8, 2), set(30, 8, 1)], exercise: upper, rirTolerance: 1 })
    expect(r.kind).toBe('increase')
  })

  it('never increases after a set flagged for poor technique', () => {
    const r = suggestProgression({
      prescription: presc,
      lastWorkingSets: [set(30, 8, 2), set(30, 8, 2, { formIssue: true })],
      exercise: upper,
      rirTolerance: 1,
    })
    expect(r).toMatchObject({ kind: 'hold', reason: 'formIssue' })
  })

  it('holds when fewer sets than prescribed were done', () => {
    const r = suggestProgression({ prescription: { ...presc, workingSets: 3 }, lastWorkingSets: [set(30, 8), set(30, 8)], exercise: upper, rirTolerance: 1 })
    expect(r).toMatchObject({ kind: 'hold', reason: 'incompleteSets' })
  })

  it('flags reps below the range', () => {
    const r = suggestProgression({ prescription: presc, lastWorkingSets: [set(30, 6), set(30, 4)], exercise: upper, rirTolerance: 1 })
    expect(r).toMatchObject({ kind: 'hold', reason: 'repsBelowMin', targetReps: 6 })
  })

  it('uses a larger step for lower-body compound lifts, rounded to equipment', () => {
    expect(loadIncrement(100, lowerCompound)).toBe(5)
    expect(loadIncrement(100, { ...lowerCompound, lowerBody: false })).toBe(2.5)
    expect(loadIncrement(60, upper)).toBe(2)
  })

  it('flags equipment steps above 10%', () => {
    const r = suggestProgression({ prescription: presc, lastWorkingSets: [set(10, 8), set(10, 8)], exercise: { ...upper, loadStepKg: 2 }, rirTolerance: 1 })
    expect(r).toMatchObject({ kind: 'increase', toKg: 12, stepAboveRange: true })
  })
})
