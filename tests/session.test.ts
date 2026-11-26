import { describe, expect, it } from 'vitest'
import { sessionRecords } from '../src/domain/records'
import * as S from '../src/domain/session'
import * as T from '../src/domain/timer'
import type { WorkoutSession } from '../src/domain/types'

let k = 0
const newId = () => `id-${++k}`
const t0 = 1_700_000_000_000
const opts = { warmupStartsTimer: false }

function session(): WorkoutSession {
  return {
    id: 's', programId: null, templateId: null, templateName: 'Teste', status: 'active',
    startedAt: t0, endedAt: null, pausedAt: null, pausedMs: 0, currentIndex: 0, restTimer: null, updatedAt: t0,
    exerciseIds: ['x'],
    exercises: [{ id: 'e', exerciseId: 'x', name: 'X', status: 'pending', sets: [], prescription: { workingSets: 3, warmupSets: 0, repMin: 6, repMax: 8, rirTarget: 2, restSec: 120 } }],
  }
}
const work = { kind: 'working' as const, weightKg: 50, reps: 8, rir: 2 }

describe('workout pause and rest timer', () => {
  it('resuming the workout resumes a timer it paused', () => {
    let s = S.addSet(session(), 0, work, t0, newId, opts)
    s = S.pauseSession(s, t0 + 30_000)
    s = S.resumeSession(s, t0 + 90_000)
    expect(T.isPaused(s.restTimer!)).toBe(false)
    expect(T.remainingMs(s.restTimer!, t0 + 90_000)).toBe(90_000)
  })

  it('resuming the workout keeps a timer the user paused on purpose', () => {
    let s = S.addSet(session(), 0, work, t0, newId, opts)
    s = S.applyTimerAction(s, { type: 'pause' }, t0 + 10_000)
    s = S.pauseSession(s, t0 + 20_000)
    s = S.resumeSession(s, t0 + 80_000)
    expect(T.isPaused(s.restTimer!)).toBe(true)
    expect(T.remainingMs(s.restTimer!, t0 + 200_000)).toBe(110_000)
  })

  it('E: workout paused, +30 s, Reiniciar: timer stays paused with the right time and resumes with the workout', () => {
    let s = S.addSet(session(), 0, work, t0, newId, opts) // rest 120 s
    s = S.pauseSession(s, t0 + 20_000)
    expect(T.isPaused(s.restTimer!)).toBe(true)
    expect(T.remainingMs(s.restTimer!, t0 + 90_000)).toBe(100_000)
    s = S.applyTimerAction(s, { type: 'extend', sec: 30 }, t0 + 40_000)
    expect(T.remainingMs(s.restTimer!, t0 + 40_000)).toBe(130_000)
    s = S.applyTimerAction(s, { type: 'restart' }, t0 + 50_000)
    expect(T.isPaused(s.restTimer!)).toBe(true)
    expect(T.remainingMs(s.restTimer!, t0 + 120_000)).toBe(100_000)
    // still linked to the workout pause, so resuming the workout resumes it
    expect(s.restTimer!.pausedAt).toBe(s.pausedAt)
    s = S.resumeSession(s, t0 + 200_000)
    expect(T.isPaused(s.restTimer!)).toBe(false)
    expect(T.remainingMs(s.restTimer!, t0 + 210_000)).toBe(90_000)
    expect(S.sessionElapsedMs(s, t0 + 210_000)).toBe(30_000)
  })

  it('Reiniciar on a running timer keeps elapsed time through the session state', () => {
    let s = S.addSet(session(), 0, work, t0, newId, opts)
    s = S.applyTimerAction(s, { type: 'extend', sec: 30 }, t0 + 20_000)
    s = S.applyTimerAction(s, { type: 'extend', sec: 15 }, t0 + 25_000)
    s = S.applyTimerAction(s, { type: 'restart' }, t0 + 30_000)
    expect(T.remainingMs(s.restTimer!, t0 + 30_000)).toBe(90_000)
    expect(s.restTimer!.startedAt).toBe(t0)
  })

  it('logging a set while paused resumes the workout', () => {
    let s = S.addSet(session(), 0, work, t0, newId, opts)
    s = S.pauseSession(s, t0 + 60_000)
    s = S.addSet(s, 0, work, t0 + 180_000, newId, opts)
    expect(s.pausedAt).toBeNull()
    expect(s.pausedMs).toBe(120_000)
    expect(T.isPaused(s.restTimer!)).toBe(false)
    expect(S.sessionElapsedMs(s, t0 + 180_000)).toBe(60_000)
  })

  it('actual rest excludes time the workout was paused', () => {
    let s = S.addSet(session(), 0, work, t0, newId, opts)
    s = S.pauseSession(s, t0 + 30_000)
    s = S.resumeSession(s, t0 + 330_000) // 5 min paused
    s = S.addSet(s, 0, work, t0 + 420_000, newId, opts)
    expect(s.exercises[0].sets[1].restBeforeSec).toBe(120)
  })

  it('actual rest is plain elapsed time without pauses', () => {
    let s = S.addSet(session(), 0, work, t0, newId, opts)
    s = S.addSet(s, 0, work, t0 + 135_000, newId, opts)
    expect(s.exercises[0].sets[1].restBeforeSec).toBe(135)
  })

  it('sets logged by older versions (no pausedMsAt) still get a rest value', () => {
    let s = S.addSet(session(), 0, work, t0, newId, opts)
    delete s.exercises[0].sets[0].pausedMsAt
    s = S.addSet(s, 0, work, t0 + 100_000, newId, opts)
    expect(s.exercises[0].sets[1].restBeforeSec).toBe(100)
  })
})


describe('records of the day', () => {
  const set = (weightKg: number, reps: number, formIssue = false) => ({ id: `r${++k}`, kind: 'working' as const, weightKg, reps, rir: 2, completedAt: 0, restBeforeSec: null, formIssue })
  const sess = (sets: ReturnType<typeof set>[]) => ({ startedAt: t0, exercises: [{ ...session().exercises[0], sets }] })

  it('detects a heavier load or more reps at the same best load', () => {
    const prev = new Map([['x', [{ date: t0 - 1, working: [set(50, 8)] }]]])
    expect(sessionRecords(sess([set(52.5, 6)]), prev)).toMatchObject([{ weightKg: 52.5, reps: 6, previous: { weightKg: 50, reps: 8 } }])
    expect(sessionRecords(sess([set(50, 9)]), prev)).toHaveLength(1)
    expect(sessionRecords(sess([set(50, 8)]), prev)).toHaveLength(0)
  })

  it('ignores first-time exercises and sets flagged for technique', () => {
    expect(sessionRecords(sess([set(60, 8)]), new Map())).toHaveLength(0)
    const prev = new Map([['x', [{ date: t0 - 1, working: [set(50, 8)] }]]])
    expect(sessionRecords(sess([set(60, 8, true)]), prev)).toHaveLength(0)
  })
})

describe('editing logged sets', () => {
  it('updates values and keeps the exercise status consistent', () => {
    let s = session()
    for (let i = 0; i < 3; i++) s = S.addSet(s, 0, work, t0 + i * 100_000, newId, opts)
    expect(s.exercises[0].status).toBe('done')
    const id = s.exercises[0].sets[1].id
    s = S.updateSet(s, 0, id, { reps: 7, formIssue: true }, t0 + 400_000)
    expect(s.exercises[0].sets[1]).toMatchObject({ reps: 7, formIssue: true })
    s = S.updateSet(s, 0, id, { kind: 'warmup' }, t0 + 410_000)
    expect(s.exercises[0].sets[1].rir).toBeNull()
    expect(s.exercises[0].status).toBe('pending') // only 2 working sets left
  })

  it('removing the set that started the timer clears the timer', () => {
    let s = S.addSet(session(), 0, work, t0, newId, opts)
    const id = s.exercises[0].sets[0].id
    expect(s.restTimer?.setId).toBe(id)
    s = S.removeSet(s, 0, id, t0 + 5000)
    expect(s.restTimer).toBeNull()
    expect(s.exercises[0].sets).toHaveLength(0)
  })
})
