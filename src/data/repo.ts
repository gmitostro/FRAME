import { withSettingsDefaults } from '../domain/defaults'
import * as S from '../domain/session'
import type {
  Exercise,
  Program,
  SetLog,
  Settings,
  TemplateExercise,
  WorkoutSession,
  WorkoutTemplate,
} from '../domain/types'
import { newId } from '../lib/id'
import { db, type FrameDB } from './db'

/**
 * Repository functions: the only place that touches IndexedDB. UI code calls
 * these and reads live data through dexie-react-hooks.
 */

export class ActiveSessionExistsError extends Error {
  readonly sessionId: string
  constructor(sessionId: string) {
    super('active-session-exists')
    this.sessionId = sessionId
  }
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`not-found:${what}`)
  }
}

// ---------- Settings ----------

export async function getSettings(database: FrameDB = db): Promise<Settings> {
  return withSettingsDefaults(await database.settings.get('singleton'))
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>, database: FrameDB = db): Promise<Settings> {
  return database.transaction('rw', database.settings, async () => {
    const current = await getSettings(database)
    const next: Settings = { ...current, ...patch, id: 'singleton', updatedAt: Date.now() }
    await database.settings.put(next)
    return next
  })
}

// ---------- Exercises ----------

export async function exerciseMap(database: FrameDB = db): Promise<Map<string, Exercise>> {
  const all = await database.exercises.toArray()
  return new Map(all.map((e) => [e.id, e]))
}

export type NewExercise = Omit<Exercise, 'id' | 'isCustom' | 'createdAt' | 'updatedAt'>

export async function createExercise(input: NewExercise, database: FrameDB = db): Promise<Exercise> {
  const now = Date.now()
  const ex: Exercise = { ...input, namePt: input.namePt.trim(), id: newId(), isCustom: true, createdAt: now, updatedAt: now }
  await database.exercises.add(ex)
  return ex
}

export async function updateExercise(id: string, patch: Partial<Exercise>, database: FrameDB = db): Promise<void> {
  const n = await database.exercises.update(id, { ...patch, id, updatedAt: Date.now() })
  if (!n) throw new NotFoundError('exercise')
}

// ---------- Program & templates ----------

export async function getActiveProgram(database: FrameDB = db): Promise<Program | undefined> {
  const all = await database.programs.toArray()
  return all.find((p) => p.isActive) ?? all[0]
}

export async function listTemplates(programId: string, database: FrameDB = db): Promise<WorkoutTemplate[]> {
  const rows = await database.templates.where('programId').equals(programId).toArray()
  return rows.sort((a, b) => a.order - b.order)
}

async function mutateTemplate(
  id: string,
  fn: (t: WorkoutTemplate) => WorkoutTemplate,
  database: FrameDB,
): Promise<WorkoutTemplate> {
  return database.transaction('rw', database.templates, async () => {
    const t = await database.templates.get(id)
    if (!t) throw new NotFoundError('template')
    const next = { ...fn(t), id: t.id, updatedAt: Date.now() }
    await database.templates.put(next)
    return next
  })
}

export async function createTemplate(programId: string, name: string, database: FrameDB = db): Promise<WorkoutTemplate> {
  const now = Date.now()
  const existing = await listTemplates(programId, database)
  const t: WorkoutTemplate = {
    id: newId(),
    programId,
    name: name.trim() || 'Treino',
    weekday: null,
    order: existing.length ? Math.max(...existing.map((e) => e.order)) + 1 : 0,
    exercises: [],
    createdAt: now,
    updatedAt: now,
  }
  await database.templates.add(t)
  return t
}

/** Deleting a workout keeps every past session (they hold snapshots). */
export async function deleteTemplate(id: string, database: FrameDB = db): Promise<void> {
  await database.templates.delete(id)
}

export function updateTemplate(
  id: string,
  patch: Partial<Pick<WorkoutTemplate, 'name' | 'weekday' | 'notes' | 'warmupNotes'>>,
  database: FrameDB = db,
): Promise<WorkoutTemplate> {
  return mutateTemplate(id, (t) => ({ ...t, ...patch }), database)
}

/** Editable starting values for a newly added exercise. */
export function defaultTemplateExercise(ex: Exercise): TemplateExercise {
  const warmupSets = ex.restProfile === 'heavyCompound' ? 2 : ex.restProfile === 'moderateCompound' ? 1 : 0
  return { id: newId(), exerciseId: ex.id, workingSets: 2, warmupSets, repMin: 6, repMax: 10, rirTarget: 2, restSec: null }
}

export async function addTemplateExercise(templateId: string, exerciseId: string, database: FrameDB = db): Promise<WorkoutTemplate> {
  const ex = await database.exercises.get(exerciseId)
  if (!ex) throw new NotFoundError('exercise')
  return mutateTemplate(templateId, (t) => ({ ...t, exercises: [...t.exercises, defaultTemplateExercise(ex)] }), database)
}

export function updateTemplateExercise(
  templateId: string,
  teId: string,
  patch: Partial<Omit<TemplateExercise, 'id'>>,
  database: FrameDB = db,
): Promise<WorkoutTemplate> {
  return mutateTemplate(
    templateId,
    (t) => ({
      ...t,
      exercises: t.exercises.map((e) => {
        if (e.id !== teId) return e
        const next = { ...e, ...patch }
        next.workingSets = clampInt(next.workingSets, 1, 10)
        next.warmupSets = clampInt(next.warmupSets, 0, 6)
        next.repMin = clampInt(next.repMin, 1, 50)
        next.repMax = clampInt(Math.max(next.repMax, next.repMin), 1, 60)
        next.rirTarget = clampInt(next.rirTarget, 0, 5)
        next.restSec = next.restSec === null ? null : clampInt(next.restSec, 15, 600)
        return next
      }),
    }),
    database,
  )
}

export function removeTemplateExercise(templateId: string, teId: string, database: FrameDB = db): Promise<WorkoutTemplate> {
  return mutateTemplate(templateId, (t) => ({ ...t, exercises: t.exercises.filter((e) => e.id !== teId) }), database)
}

export function moveTemplateExercise(templateId: string, teId: string, delta: -1 | 1, database: FrameDB = db): Promise<WorkoutTemplate> {
  return mutateTemplate(
    templateId,
    (t) => {
      const i = t.exercises.findIndex((e) => e.id === teId)
      const j = i + delta
      if (i < 0 || j < 0 || j >= t.exercises.length) return t
      const exercises = [...t.exercises]
      ;[exercises[i], exercises[j]] = [exercises[j], exercises[i]]
      return { ...t, exercises }
    },
    database,
  )
}

function clampInt(v: number, min: number, max: number): number {
  const n = Number.isFinite(v) ? Math.round(v) : min
  return Math.min(max, Math.max(min, n))
}

// ---------- Sessions ----------

export async function getActiveSession(database: FrameDB = db): Promise<WorkoutSession | undefined> {
  return database.sessions.where('status').equals('active').first()
}

export async function startSession(templateId: string, database: FrameDB = db): Promise<WorkoutSession> {
  return database.transaction('rw', [database.sessions, database.templates, database.exercises, database.settings], async () => {
    const active = await getActiveSession(database)
    if (active) throw new ActiveSessionExistsError(active.id)
    const template = await database.templates.get(templateId)
    if (!template) throw new NotFoundError('template')
    const map = await exerciseMap(database)
    const settings = await getSettings(database)
    const session = S.buildSession(template, (id) => map.get(id), settings, Date.now(), newId)
    await database.sessions.add(session)
    return session
  })
}

/** Read-modify-write inside one transaction so quick double taps are safe. */
export async function mutateSession(
  id: string,
  fn: (s: WorkoutSession, now: number) => WorkoutSession,
  database: FrameDB = db,
): Promise<WorkoutSession> {
  return database.transaction('rw', database.sessions, async () => {
    const s = await database.sessions.get(id)
    if (!s) throw new NotFoundError('session')
    const next = fn(s, Date.now())
    if (next !== s) await database.sessions.put(next)
    return next
  })
}

export async function completedSessions(database: FrameDB = db): Promise<WorkoutSession[]> {
  const rows = await database.sessions.where('status').equals('completed').toArray()
  return rows.sort((a, b) => b.startedAt - a.startedAt)
}

export interface ExercisePerformance {
  sessionId: string
  date: number
  working: SetLog[]
  warmup: SetLog[]
}

/** Every completed session's sets for one exercise, newest first. */
export async function exerciseHistory(exerciseId: string, database: FrameDB = db): Promise<ExercisePerformance[]> {
  const rows = await database.sessions.where('exerciseIds').equals(exerciseId).toArray()
  const out: ExercisePerformance[] = []
  for (const s of rows) {
    if (s.status !== 'completed') continue
    const sets = s.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets)
    const working = sets.filter((x) => x.kind === 'working')
    if (!sets.length) continue
    out.push({ sessionId: s.id, date: s.startedAt, working, warmup: sets.filter((x) => x.kind === 'warmup') })
  }
  return out.sort((a, b) => b.date - a.date)
}

export async function lastPerformance(exerciseId: string, database: FrameDB = db): Promise<ExercisePerformance | null> {
  const history = await exerciseHistory(exerciseId, database)
  return history.find((h) => h.working.length > 0) ?? null
}
