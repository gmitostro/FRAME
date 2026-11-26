import { describe, expect, it } from 'vitest'
import { validateProgram } from '../src/data/program'
import { seedExercises } from '../src/data/seed/exercises'
import { FRFB_V1 } from '../src/data/seed/frfb-v1'
import { LIBRARY_LOAD_OVERRIDES, loadProfile, weightMeaning } from '../src/domain/load'
import * as S from '../src/domain/session'
import type { Exercise, WorkoutSession } from '../src/domain/types'

const lib = seedExercises(0)
const byId = new Map(lib.map((e) => [e.id, e]))
const ex = (id: string) => byId.get(id)!

describe('load classification', () => {
  it('every library override points to a real library exercise', () => {
    for (const id of Object.keys(LIBRARY_LOAD_OVERRIDES)) expect(byId.has(id), id).toBe(true)
  })

  it('derives defaults from the equipment', () => {
    expect(loadProfile(ex('supino-reto-barra'))).toEqual({ loadType: 'external', loadBasis: 'total', unilateral: false, measure: 'reps' })
    expect(loadProfile(ex('supino-inclinado-halteres'))).toMatchObject({ loadType: 'external', loadBasis: 'perDumbbell' })
    expect(loadProfile(ex('barra-fixa'))).toMatchObject({ loadType: 'bodyweight' })
    expect(loadProfile({ id: 'x', equipment: 'band' })).toMatchObject({ loadType: 'none' })
  })

  it('applies library exceptions (unilateral, no load)', () => {
    expect(loadProfile(ex('remada-unilateral'))).toMatchObject({ loadBasis: 'perDumbbell', unilateral: true })
    expect(loadProfile(ex('elevacao-lateral-polia'))).toMatchObject({ loadBasis: 'total', unilateral: true })
    expect(loadProfile(ex('roda-abdominal'))).toMatchObject({ loadType: 'none' })
  })

  it('explicit fields saved by the user win over library and equipment', () => {
    const edited: Exercise = { ...ex('remada-unilateral'), unilateral: false, loadBasis: 'total' }
    expect(loadProfile(edited)).toMatchObject({ loadBasis: 'total', unilateral: false })
    expect(loadProfile({ ...ex('barra-fixa'), loadType: 'assisted' })).toMatchObject({ loadType: 'assisted' })
  })

  it('every FRFB V1 exercise has a classification, all external and repetition-based', () => {
    for (const w of FRFB_V1.workouts) for (const e of w.exercises) {
      const p = loadProfile(ex(e.exerciseId))
      expect(p.measure).toBe('reps')
      expect(p.loadType).toBe('external')
    }
  })

  it('maps the classification to what the logged weight means', () => {
    expect(weightMeaning({ loadType: 'external', loadBasis: 'perDumbbell', unilateral: false, measure: 'reps' })).toBe('perDumbbell')
    expect(weightMeaning({ loadType: 'bodyweight', loadBasis: 'total', unilateral: false, measure: 'reps' })).toBe('added')
    expect(weightMeaning({ loadType: 'assisted', loadBasis: 'total', unilateral: false, measure: 'reps' })).toBe('assistance')
    expect(weightMeaning({ loadType: 'none', loadBasis: 'total', unilateral: false, measure: 'reps' })).toBe('none')
  })
})

let k = 0
const newId = () => `id-${++k}`
const settings = { restProfiles: { heavyCompound: 180, moderateCompound: 150, isolation: 120, lightIsolation: 90 }, minRestSec: 90 }
const opts = { warmupStartsTimer: false }
function session(): WorkoutSession {
  const tpl = { id: 't', programId: 'p', name: 'T', weekday: null, order: 0, createdAt: 0, updatedAt: 0, exercises: [{ id: 'te', exerciseId: 'remada-unilateral', workingSets: 2, warmupSets: 1, repMin: 8, repMax: 10, rirTarget: 2, restSec: null }] }
  return S.buildSession(tpl, (id) => byId.get(id), settings, 1000, newId)
}

describe('session snapshots and RIR origin', () => {
  it('snapshots the load classification when the session starts', () => {
    expect(session().exercises[0].loadProfile).toEqual({ loadType: 'external', loadBasis: 'perDumbbell', unilateral: true, measure: 'reps' })
  })

  it('substitution and added exercises carry their own classification', () => {
    const s0 = session()
    const swapped = S.substituteExercise(s0, 0, ex('barra-fixa'), 2000, newId, settings)
    expect(swapped.exercises[0].loadProfile).toMatchObject({ loadType: 'bodyweight', unilateral: false })
    const added = S.addExerciseToSession(s0, ex('roda-abdominal'), 2000, newId, settings)
    expect(added.exercises.at(-1)!.loadProfile).toMatchObject({ loadType: 'none' })
  })

  it('stores who set the RIR on working sets only', () => {
    let s = session()
    s = S.addSet(s, 0, { kind: 'warmup', weightKg: 10, reps: 10, rir: null, rirSource: 'user' }, 2000, newId, opts)
    s = S.addSet(s, 0, { kind: 'working', weightKg: 20, reps: 10, rir: 2, rirSource: 'default' }, 3000, newId, opts)
    s = S.addSet(s, 0, { kind: 'working', weightKg: 20, reps: 9, rir: 1, rirSource: 'user' }, 4000, newId, opts)
    expect(s.exercises[0].sets.map((x) => [x.kind, x.rir, x.rirSource])).toEqual([
      ['warmup', null, undefined],
      ['working', 2, 'default'],
      ['working', 1, 'user'],
    ])
  })

  it('editing: choosing an RIR marks it as user; other edits keep the origin; warm-up clears it', () => {
    let s = session()
    s = S.addSet(s, 0, { kind: 'working', weightKg: 20, reps: 10, rir: 2, rirSource: 'default' }, 3000, newId, opts)
    const id = s.exercises[0].sets[0].id
    s = S.updateSet(s, 0, id, { reps: 11 }, 3500)
    expect(s.exercises[0].sets[0]).toMatchObject({ reps: 11, rirSource: 'default' })
    s = S.updateSet(s, 0, id, { rir: 1, rirSource: 'user' }, 3600)
    expect(s.exercises[0].sets[0]).toMatchObject({ rir: 1, rirSource: 'user' })
    s = S.updateSet(s, 0, id, { kind: 'warmup' }, 3700)
    expect(s.exercises[0].sets[0]).toMatchObject({ rir: null, rirSource: undefined })
  })

  it('legacy sets without an RIR origin stay unknown after edits', () => {
    let s = session()
    s = S.addSet(s, 0, { kind: 'working', weightKg: 20, reps: 10, rir: 2 }, 3000, newId, opts)
    expect(s.exercises[0].sets[0].rirSource).toBeUndefined()
    s = S.updateSet(s, 0, s.exercises[0].sets[0].id, { weightKg: 22 }, 3100)
    expect(s.exercises[0].sets[0].rirSource).toBeUndefined()
  })
})

describe('program files with classification', () => {
  const ids = new Set(lib.map((e) => e.id))
  const custom = { ...ex('barra-fixa'), id: 'custom-1', namePt: 'Barra fixa assistida', equipment: 'machine' as const }
  const file = (extra: Record<string, unknown>) =>
    JSON.stringify({ format: 'frame-program', version: 1, name: 'X', customExercises: [{ ...custom, ...extra }], workouts: [{ name: 'A', weekday: 1, exercises: [] }] })

  it('accepts valid or absent classification and rejects invalid values', () => {
    expect(validateProgram(file({}), ids).ok).toBe(true)
    expect(validateProgram(file({ loadType: 'assisted', loadBasis: 'total', unilateral: false, measure: 'reps' }), ids).ok).toBe(true)
    expect(validateProgram(file({ loadType: 'gravity' }), ids)).toMatchObject({ ok: false })
    expect(validateProgram(file({ unilateral: 'yes' }), ids)).toMatchObject({ ok: false })
  })
})
