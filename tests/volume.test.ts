import { describe, expect, it } from 'vitest'
import { FRFB_V1 } from '../src/data/seed/frfb-v1'
import { seedExercises } from '../src/data/seed/exercises'
import { defaultSettings } from '../src/domain/defaults'
import type { SetLog, WorkoutSession, WorkoutTemplate } from '../src/domain/types'
import { performedVolume, plannedVolume, volumeRows, volumeStatus } from '../src/domain/volume'
import { addWeeks, startOfWeek } from '../src/domain/week'

const lib = new Map(seedExercises(0).map((e) => [e.id, e]))
const lookup = (id: string) => lib.get(id)

const templates: WorkoutTemplate[] = FRFB_V1.workouts.map((w, i) => ({
  id: `t${i}`, programId: 'p', name: w.name, weekday: w.weekday, order: i, createdAt: 0, updatedAt: 0,
  exercises: w.exercises.map((e, j) => ({ ...e, id: `t${i}-${j}` })),
}))

let k = 0
const set = (kind: SetLog['kind'], extra: Partial<SetLog> = {}): SetLog => ({
  id: `s${++k}`, kind, weightKg: 20, reps: 10, rir: kind === 'working' ? 2 : null, completedAt: 0, restBeforeSec: null, ...extra,
})
function session(startedAt: number, exercises: Array<[string, SetLog[]]>, status: WorkoutSession['status'] = 'completed'): WorkoutSession {
  return {
    id: `x${++k}`, programId: 'p', templateId: null, templateName: 'T', status, startedAt, endedAt: startedAt + 1, pausedAt: null, pausedMs: 0,
    currentIndex: 0, restTimer: null, updatedAt: startedAt, exerciseIds: exercises.map(([id]) => id),
    exercises: exercises.map(([exerciseId, sets]) => ({
      id: `e${++k}`, exerciseId, name: exerciseId, status: 'done', sets,
      prescription: { workingSets: 3, warmupSets: 0, repMin: 8, repMax: 12, rirTarget: 2, restSec: 90 },
    })),
  }
}

describe('planned weekly volume (FRFB V1)', () => {
  const { volume, unknownSets } = plannedVolume(templates, lookup)

  it('direct sets match the ficha summary', () => {
    expect(unknownSets).toBe(0)
    expect(volume.get('biceps')?.direct).toBe(6)
    expect(volume.get('triceps')?.direct).toBe(6)
    expect(volume.get('lateralDelts')?.direct).toBe(6)
    expect(volume.get('chest')?.direct).toBe(6)
    expect((volume.get('lats')?.direct ?? 0) + (volume.get('upperBack')?.direct ?? 0)).toBe(12)
  })

  it('counts secondary muscles as indirect, separately from direct', () => {
    // Every pull lists biceps as secondary: puxada neutra 3, remada máquina 2,
    // remada baixa 2, puxada unilateral 3, puxada aberta 2 (library classification).
    const pulls = ['puxada-neutra', 'remada-maquina', 'remada-baixa', 'puxada-unilateral', 'puxada-aberta']
    const expected = templates.flatMap((t) => t.exercises).filter((e) => lib.get(e.exerciseId)!.secondaryMuscles.includes('biceps')).reduce((n, e) => n + e.workingSets, 0)
    expect(pulls.every((id) => lib.get(id)!.secondaryMuscles.includes('biceps'))).toBe(true)
    expect(volume.get('biceps')?.indirect).toBe(expected)
    expect(expected).toBeGreaterThan(0)
  })
})

describe('performed weekly volume', () => {
  const monday = startOfWeek(new Date(2026, 10, 25, 12).getTime()) // week of 23/11/2026
  const next = addWeeks(monday, 1)

  it('counts working sets of completed sessions inside the week only', () => {
    const sessions = [
      session(monday + 3_600_000, [['rosca-scott', [set('warmup'), set('working'), set('working', { formIssue: true })]]]),
      session(monday - 3_600_000, [['rosca-scott', [set('working')]]]), // previous week
      session(next, [['rosca-scott', [set('working')]]]), // next week
      session(monday + 7_200_000, [['rosca-scott', [set('working')]]], 'active'), // not finished
      session(monday + 9_000_000, [['remada-baixa', [set('working'), set('working')]], ['nao-existe', [set('working')]]]),
    ]
    const r = performedVolume(sessions, lookup, monday, next)
    expect(r.sessions).toBe(2)
    expect(r.volume.get('biceps')).toEqual({ direct: 2, indirect: 2 }) // warm-up excluded, form issue counted
    expect(r.volume.get('upperBack')?.direct).toBe(2)
    expect(r.unknownSets).toBe(1)
  })

  it('week boundaries survive a DST change (calendar weeks)', () => {
    expect(new Date(addWeeks(monday, 20)).getDay()).toBe(1)
    expect(new Date(addWeeks(monday, 20)).getHours()).toBe(0)
  })
})

describe('rows and priority comparison', () => {
  it('lists priorities first, even with zero sets, then other trained muscles', () => {
    const settings = defaultSettings(0)
    const { volume } = plannedVolume(templates, lookup)
    const rows = volumeRows(volume, new Map(), { primary: [...settings.priorities.primary, 'adductors'], secondary: settings.priorities.secondary })
    expect(rows.slice(0, 5).map((r) => [r.muscle, r.tier])).toEqual([
      ['biceps', 'primary'], ['triceps', 'primary'], ['adductors', 'primary'], ['lateralDelts', 'secondary'], ['lats', 'secondary'],
    ])
    expect(rows.find((r) => r.muscle === 'adductors')?.plannedStatus).toBe('none')
    expect(rows.find((r) => r.muscle === 'biceps')).toMatchObject({ plannedStatus: 'below', performedStatus: 'none' })
    expect(rows.slice(5).every((r) => r.tier === null)).toBe(true)
    expect(rows.some((r) => r.muscle === 'adductors' && r.tier === null)).toBe(false)
  })

  it('status thresholds follow the reference (≥10, diminishing above 20)', () => {
    expect([0, 9, 10, 20, 21].map(volumeStatus)).toEqual(['none', 'below', 'within', 'within', 'above'])
  })
})
