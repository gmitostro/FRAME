import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBackup, restoreBackup, validateBackup } from '../src/data/backup'
import { FrameDB, syncExerciseSeed } from '../src/data/db'
import * as R from '../src/data/repo'
import * as S from '../src/domain/session'
import { newId } from '../src/lib/id'

let db: FrameDB
let n = 0

beforeEach(async () => {
  db = new FrameDB(`test-${++n}`)
  await db.open()
})
afterEach(async () => {
  await db.delete()
})

/** A fresh, empty workout so tests do not depend on the seeded ficha. */
async function frameA() {
  const program = await R.getActiveProgram(db)
  return R.createTemplate(program!.id, 'Teste', db)
}

describe('database seed', () => {
  it('creates the exercise library, the FRFB V1 program and settings', async () => {
    expect(await db.exercises.count()).toBeGreaterThan(70)
    const program = await R.getActiveProgram(db)
    expect(program?.name).toBe('FRFB V1')
    const templates = await R.listTemplates(program!.id, db)
    expect(templates.map((t) => [t.name, t.weekday, t.exercises.length])).toEqual([
      ['Frame A', 1, 6], ['Full Body A', 2, 6], ['Frame B', 3, 5], ['Full Body B', 4, 6],
    ])
    expect(templates[0].exercises[0]).toMatchObject({ exerciseId: 'elevacao-lateral-maquina', workingSets: 3, repMin: 10, repMax: 15, restSec: 120 })
    const s = await R.getSettings(db)
    expect(s.trainingDays).toEqual([1, 2, 3, 4])
    expect(s.restProfiles.heavyCompound).toBe(180)
  })

  it('re-adds missing library rows without touching edited ones', async () => {
    await db.exercises.update('rosca-scott', { namePt: 'Rosca Scott (minha)' })
    await db.exercises.delete('rosca-martelo')
    await db.meta.put({ key: 'exerciseSeedVersion', value: 0 })
    expect(await syncExerciseSeed(db)).toBe(1)
    expect((await db.exercises.get('rosca-scott'))?.namePt).toBe('Rosca Scott (minha)')
  })
})

describe('program editing', () => {
  it('adds, edits, reorders and removes exercises with clamped values', async () => {
    const t = await frameA()
    await R.addTemplateExercise(t.id, 'rosca-direta-barra', db)
    let after = await R.addTemplateExercise(t.id, 'triceps-corda', db)
    const [a, b] = after.exercises
    after = await R.updateTemplateExercise(t.id, a.id, { workingSets: 99, repMin: 8, repMax: 5 }, db)
    expect(after.exercises[0]).toMatchObject({ workingSets: 10, repMin: 8, repMax: 8 })
    after = await R.moveTemplateExercise(t.id, b.id, -1, db)
    expect(after.exercises[0].id).toBe(b.id)
    after = await R.removeTemplateExercise(t.id, a.id, db)
    expect(after.exercises.map((e) => e.exerciseId)).toEqual(['triceps-corda'])
  })
})

describe('live workout persistence', () => {
  it('persists every set, timer and status, and keeps history after template edits', async () => {
    const t = await frameA()
    await R.addTemplateExercise(t.id, 'supino-reto-barra', db)
    const session = await R.startSession(t.id, db)
    expect(session.exercises[0].prescription.restSec).toBe(180)
    await expect(R.startSession(t.id, db)).rejects.toBeInstanceOf(R.ActiveSessionExistsError)

    await R.mutateSession(session.id, (s, now) => S.addSet(s, 0, { kind: 'warmup', weightKg: 40, reps: 8, rir: null }, now, newId, { warmupStartsTimer: false }), db)
    let stored = await R.getActiveSession(db)
    expect(stored?.restTimer).toBeNull() // warm-up does not start the timer by default

    await R.mutateSession(session.id, (s, now) => S.addSet(s, 0, { kind: 'working', weightKg: 80, reps: 8, rir: 2 }, now, newId, { warmupStartsTimer: false }), db)
    stored = await R.getActiveSession(db)
    expect(stored?.restTimer?.durationMs).toBe(180_000)
    expect(stored?.exercises[0].sets).toHaveLength(2)

    // A fresh connection (like a page reload) sees the same state.
    const reopened = new FrameDB(db.name)
    await reopened.open()
    expect((await R.getActiveSession(reopened))?.exercises[0].sets).toHaveLength(2)
    reopened.close()

    await R.mutateSession(session.id, (s, now) => S.addSet(s, 0, { kind: 'working', weightKg: 80, reps: 7, rir: 1 }, now, newId, { warmupStartsTimer: false }), db)
    await R.mutateSession(session.id, (s, now) => S.finishSession(s, now), db)
    expect(await R.getActiveSession(db)).toBeUndefined()

    // Editing the template later does not change the recorded session.
    const te = (await db.templates.get(t.id))!.exercises[0]
    await R.updateTemplateExercise(t.id, te.id, { workingSets: 4 }, db)
    const last = await R.lastPerformance('supino-reto-barra', db)
    expect(last?.working.map((x) => x.reps)).toEqual([8, 7])
    expect(last?.warmup).toHaveLength(1)
    const done = await R.completedSessions(db)
    expect(done[0].exercises[0].prescription.workingSets).toBe(2)
  })

  it('substitutes an exercise in place or after logged sets', async () => {
    const t = await frameA()
    await R.addTemplateExercise(t.id, 'rosca-direta-barra', db)
    const session = await R.startSession(t.id, db)
    const scott = (await db.exercises.get('rosca-scott'))!
    const settings = await R.getSettings(db)
    let s = await R.mutateSession(session.id, (x, now) => S.substituteExercise(x, 0, scott, now, newId, settings), db)
    expect(s.exercises[0]).toMatchObject({ exerciseId: 'rosca-scott', substitutedFor: { exerciseId: 'rosca-direta-barra' } })
    s = await R.mutateSession(session.id, (x, now) => S.addSet(x, 0, { kind: 'working', weightKg: 20, reps: 10, rir: 2 }, now, newId, { warmupStartsTimer: false }), db)
    const martelo = (await db.exercises.get('rosca-martelo'))!
    s = await R.mutateSession(session.id, (x, now) => S.substituteExercise(x, 0, martelo, now, newId, settings), db)
    expect(s.exercises.map((e) => [e.exerciseId, e.status])).toEqual([['rosca-scott', 'done'], ['rosca-martelo', 'pending']])
    expect(s.exercises[1].prescription.workingSets).toBe(1)
    expect(s.exerciseIds).toContain('rosca-martelo')
  })

  it('excludes pauses from workout time and rest timer', async () => {
    const t = await frameA()
    await R.addTemplateExercise(t.id, 'rosca-direta-barra', db)
    const base = await R.startSession(t.id, db)
    const t0 = base.startedAt
    let s = S.addSet(base, 0, { kind: 'working', weightKg: 20, reps: 10, rir: 2 }, t0 + 60_000, newId, { warmupStartsTimer: false })
    s = S.pauseSession(s, t0 + 70_000)
    s = S.resumeSession(s, t0 + 370_000) // 5 min pause
    expect(S.sessionElapsedMs(s, t0 + 400_000)).toBe(100_000)
    // timer started at 60 s, 10 s before pause, 30 s after resume: 40 s elapsed of 120
    expect(s.restTimer!.durationMs - (t0 + 400_000 - s.restTimer!.startedAt - s.restTimer!.pausedMs)).toBe(80_000)
  })
})

describe('backup', () => {
  it('round-trips the whole database and rejects invalid files', async () => {
    const t = await frameA()
    await R.addTemplateExercise(t.id, 'rosca-direta-barra', db)
    const session = await R.startSession(t.id, db)
    await R.mutateSession(session.id, (s, now) => S.finishSession(S.addSet(s, 0, { kind: 'working', weightKg: 30, reps: 8, rir: 2 }, now, newId, { warmupStartsTimer: false }), now), db)
    const json = JSON.stringify(await createBackup(db))

    const v = validateBackup(json)
    expect(v.ok).toBe(true)
    if (!v.ok) return
    await db.sessions.clear()
    await restoreBackup(v.backup, db)
    expect(await db.sessions.count()).toBe(1)
    expect((await R.lastPerformance('rosca-direta-barra', db))?.working[0].weightKg).toBe(30)

    expect(validateBackup('not json')).toMatchObject({ ok: false, error: 'notJson' })
    expect(validateBackup('{"format":"x"}')).toMatchObject({ ok: false, error: 'wrongFormat' })
    const broken = JSON.parse(json)
    broken.data.sessions[0].exercises[0].sets[0].reps = 'oito'
    expect(validateBackup(JSON.stringify(broken))).toMatchObject({ ok: false, error: 'invalidRecord', detail: 'sessions' })
    const newer = JSON.parse(json)
    newer.version = 99
    expect(validateBackup(JSON.stringify(newer))).toMatchObject({ ok: false, error: 'newerVersion' })
  })
})

describe('v0.3 data foundation compatibility', () => {
  it('round-trips RIR origin and load snapshots through a backup', async () => {
    const t = await frameA()
    await R.addTemplateExercise(t.id, 'remada-unilateral', db)
    const session = await R.startSession(t.id, db)
    await R.mutateSession(session.id, (s, now) => S.finishSession(S.addSet(s, 0, { kind: 'working', weightKg: 30, reps: 10, rir: 2, rirSource: 'user' }, now, newId, { warmupStartsTimer: false }), now), db)
    const v = validateBackup(JSON.stringify(await createBackup(db)))
    expect(v.ok).toBe(true)
    if (!v.ok) return
    await db.sessions.clear()
    await restoreBackup(v.backup, db)
    const done = (await R.completedSessions(db))[0]
    expect(done.exercises[0].sets[0].rirSource).toBe('user')
    expect(done.exercises[0].loadProfile).toMatchObject({ loadBasis: 'perDumbbell', unilateral: true })
  })

  it('restores a pre-v0.3 backup (no RIR origin, no snapshots, no classification) and keeps working', async () => {
    const t = await frameA()
    await R.addTemplateExercise(t.id, 'remada-unilateral', db)
    const session = await R.startSession(t.id, db)
    await R.mutateSession(session.id, (s, now) => S.finishSession(S.addSet(s, 0, { kind: 'working', weightKg: 30, reps: 10, rir: 2, rirSource: 'default' }, now, newId, { warmupStartsTimer: false }), now), db)
    const backup = JSON.parse(JSON.stringify(await createBackup(db)))
    // strip every v0.3 field, as an older app would have written it
    for (const s of backup.data.sessions) for (const e of s.exercises) {
      delete e.loadProfile
      for (const x of e.sets) delete x.rirSource
    }
    for (const e of backup.data.exercises) for (const f of ['loadType', 'loadBasis', 'unilateral', 'measure']) delete e[f]
    const v = validateBackup(JSON.stringify(backup))
    expect(v.ok).toBe(true)
    if (!v.ok) return
    await restoreBackup(v.backup, db)
    const last = await R.lastPerformance('remada-unilateral', db)
    expect(last?.working[0]).toMatchObject({ weightKg: 30, reps: 10, rir: 2 })
    expect(last?.working[0].rirSource).toBeUndefined() // unknown, not invented
    // a new session after restore gets a snapshot from the library classification
    const next = await R.startSession(t.id, db)
    expect(next.exercises.at(-1)!.loadProfile).toMatchObject({ loadBasis: 'perDumbbell', unilateral: true })
  })
})
