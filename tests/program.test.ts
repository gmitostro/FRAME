import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FrameDB } from '../src/data/db'
import { applyProgram, exportProgram, validateProgram } from '../src/data/program'
import * as R from '../src/data/repo'
import { FRFB_V1 } from '../src/data/seed/frfb-v1'
import { seedExercises } from '../src/data/seed/exercises'
import { defaultSettings } from '../src/domain/defaults'
import { estimateSession } from '../src/domain/duration'
import * as S from '../src/domain/session'
import { newId } from '../src/lib/id'

const libraryIds = new Set(seedExercises(0).map((e) => e.id))
let db: FrameDB
let n = 0
beforeEach(async () => {
  db = new FrameDB(`prog-${++n}`)
  await db.open()
})
afterEach(async () => {
  await db.delete()
})

describe('FRFB V1 ficha', () => {
  it('references only library exercises and passes validation', () => {
    const v = validateProgram(JSON.stringify(FRFB_V1), libraryIds)
    expect(v.ok).toBe(true)
  })

  it('matches the ficha: sets, reps and weekly direct sets per priority muscle', () => {
    const lib = new Map(seedExercises(0).map((e) => [e.id, e]))
    const weekly = new Map<string, number>()
    for (const w of FRFB_V1.workouts)
      for (const e of w.exercises) {
        const m = lib.get(e.exerciseId)!.primaryMuscle
        weekly.set(m, (weekly.get(m) ?? 0) + e.workingSets)
      }
    // Same totals as the ficha's "Resumo de volume direto aproximado (V1)"
    expect(weekly.get('biceps')).toBe(6)
    expect(weekly.get('triceps')).toBe(6)
    expect(weekly.get('lateralDelts')).toBe(6)
    expect(weekly.get('chest')).toBe(6)
    expect((weekly.get('lats') ?? 0) + (weekly.get('upperBack') ?? 0)).toBe(12)
    expect(weekly.get('quads')).toBe(5) // hack 3 + leg press 2 (the ficha's 8 also counts indirect work)
    expect(weekly.get('hamstrings')).toBe(5)
  })

  it('estimates each session near the 55–65 min target', () => {
    const lib = new Map(seedExercises(0).map((e) => [e.id, e]))
    const settings = defaultSettings(0)
    const minutes = FRFB_V1.workouts.map((w) => {
      const tes = w.exercises.map((e) => ({ ...e, id: newId() }))
      return [w.name, Math.round(estimateSession(tes, (id) => lib.get(id), settings).totalSec / 60)] as const
    })
    console.log('FRFB V1 estimated minutes:', minutes)
    for (const [, min] of minutes) {
      expect(min).toBeGreaterThan(35)
      expect(min).toBeLessThan(75)
    }
  })
})

describe('program import and export', () => {
  it('rejects unknown exercises and bad structures', () => {
    const bad = { ...FRFB_V1, workouts: [{ name: 'X', weekday: 1, exercises: [{ ...FRFB_V1.workouts[0].exercises[0], exerciseId: 'nao-existe' }] }] }
    expect(validateProgram(JSON.stringify(bad), libraryIds)).toMatchObject({ ok: false, error: 'unknownExercise', detail: 'nao-existe' })
    const badReps = { ...FRFB_V1, workouts: [{ name: 'X', weekday: 1, exercises: [{ ...FRFB_V1.workouts[0].exercises[0], repMin: 12, repMax: 8 }] }] }
    expect(validateProgram(JSON.stringify(badReps), libraryIds)).toMatchObject({ ok: false, error: 'invalidWorkout' })
    expect(validateProgram('{"format":"frame-backup"}', libraryIds)).toMatchObject({ ok: false, error: 'wrongFormat' })
  })

  it('replaces workouts without touching history, and round-trips with custom exercises', async () => {
    const program = await R.getActiveProgram(db)
    const tpl = (await R.listTemplates(program!.id, db))[0]
    const session = await R.startSession(tpl.id, db)
    await R.mutateSession(session.id, (s, now) => S.finishSession(S.addSet(s, 0, { kind: 'working', weightKg: 20, reps: 12, rir: 1 }, now, newId, { warmupStartsTimer: false }), now), db)

    const custom = await R.createExercise({ namePt: 'Minha remada', primaryMuscle: 'lats', secondaryMuscles: [], equipment: 'cable', pattern: 'horizontalPull', category: 'compound', restProfile: 'moderateCompound', loadStepKg: 2.5, lowerBody: false }, db)
    await R.addTemplateExercise(tpl.id, custom.id, db)
    const exported = await exportProgram(db)
    expect(exported.customExercises?.map((c) => c.id)).toEqual([custom.id])

    await applyProgram({ format: 'frame-program', version: 1, name: 'Mini', workouts: [{ name: 'Único', weekday: 1, exercises: [] }] }, db)
    expect((await R.listTemplates(program!.id, db)).map((t) => t.name)).toEqual(['Único'])
    expect((await R.getActiveProgram(db))?.name).toBe('Mini')
    expect(await R.completedSessions(db)).toHaveLength(1)

    // Import the export into a fresh database: the custom exercise comes along.
    const other = new FrameDB(`prog-other-${n}`)
    await other.open()
    const ids = new Set(await other.exercises.toCollection().primaryKeys())
    const v = validateProgram(JSON.stringify(exported), ids)
    expect(v.ok).toBe(true)
    if (v.ok) await applyProgram(v.program, other)
    const t2 = await R.listTemplates((await R.getActiveProgram(other))!.id, other)
    expect(t2[0].exercises.at(-1)?.exerciseId).toBe(custom.id)
    expect((await other.exercises.get(custom.id))?.namePt).toBe('Minha remada')
    await other.delete()
  })
})
