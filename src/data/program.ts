import type { Exercise, Program, TemplateExercise } from '../domain/types'
import { MUSCLE_GROUPS, EQUIPMENT, MOVEMENT_PATTERNS, EXERCISE_CATEGORIES, REST_PROFILES, LOAD_TYPES, LOAD_BASES, MEASURES } from '../domain/types'
import { newId } from '../lib/id'
import { db, type FrameDB } from './db'
import { templatesFromProgram } from './seed/program'

export { templatesFromProgram }

/**
 * Program file ("ficha") format: a training program without history, used
 * to import, export and ship programs. Documented in ARCHITECTURE.md.
 * Applying a program replaces the active program's workouts; past sessions
 * keep their own snapshots and are never touched.
 */

export const PROGRAM_FORMAT = 'frame-program'
export const PROGRAM_VERSION = 1

export type ProgramExercise = Omit<TemplateExercise, 'id'>

export interface ProgramWorkout {
  name: string
  weekday: number | null
  notes?: string
  warmupNotes?: string
  exercises: ProgramExercise[]
}

export type CustomExerciseDef = Omit<Exercise, 'isCustom' | 'createdAt' | 'updatedAt'>

export interface ProgramFile {
  format: typeof PROGRAM_FORMAT
  version: number
  name: string
  source?: string
  /** Custom exercises the workouts reference (library ones are referenced by id). */
  customExercises?: CustomExerciseDef[]
  workouts: ProgramWorkout[]
}

export type ProgramError = 'notJson' | 'wrongFormat' | 'newerVersion' | 'invalidWorkout' | 'unknownExercise'

export type ProgramValidation = { ok: true; program: ProgramFile } | { ok: false; error: ProgramError; detail?: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

function validCustom(e: unknown): e is CustomExerciseDef {
  return (
    isObj(e) &&
    typeof e.id === 'string' &&
    typeof e.namePt === 'string' &&
    (MUSCLE_GROUPS as readonly string[]).includes(e.primaryMuscle as string) &&
    Array.isArray(e.secondaryMuscles) &&
    (EQUIPMENT as readonly string[]).includes(e.equipment as string) &&
    (MOVEMENT_PATTERNS as readonly string[]).includes(e.pattern as string) &&
    (EXERCISE_CATEGORIES as readonly string[]).includes(e.category as string) &&
    (REST_PROFILES as readonly string[]).includes(e.restProfile as string) &&
    typeof e.loadStepKg === 'number' &&
    typeof e.lowerBody === 'boolean' &&
    // optional load classification (v0.3): valid when present
    (e.loadType === undefined || (LOAD_TYPES as readonly string[]).includes(e.loadType as string)) &&
    (e.loadBasis === undefined || (LOAD_BASES as readonly string[]).includes(e.loadBasis as string)) &&
    (e.unilateral === undefined || typeof e.unilateral === 'boolean') &&
    (e.measure === undefined || (MEASURES as readonly string[]).includes(e.measure as string))
  )
}

function validExercise(e: unknown): e is ProgramExercise {
  if (!isObj(e) || typeof e.exerciseId !== 'string') return false
  if (!isInt(e.workingSets, 1, 10) || !isInt(e.warmupSets, 0, 6)) return false
  if (!isInt(e.repMin, 1, 50) || !isInt(e.repMax, 1, 60) || (e.repMax as number) < (e.repMin as number)) return false
  if (!isInt(e.rirTarget, 0, 5)) return false
  if (!(e.restSec === null || isInt(e.restSec, 15, 600))) return false
  return e.notes === undefined || typeof e.notes === 'string'
}

/** Validates structure and that every exercise exists (library or custom). */
export function validateProgram(input: string | unknown, libraryIds: Set<string>): ProgramValidation {
  let parsed: unknown = input
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input)
    } catch {
      return { ok: false, error: 'notJson' }
    }
  }
  if (!isObj(parsed) || parsed.format !== PROGRAM_FORMAT || !Array.isArray(parsed.workouts) || typeof parsed.name !== 'string')
    return { ok: false, error: 'wrongFormat' }
  if (typeof parsed.version !== 'number' || parsed.version > PROGRAM_VERSION) return { ok: false, error: 'newerVersion' }
  const customs = parsed.customExercises === undefined ? [] : parsed.customExercises
  if (!Array.isArray(customs) || !customs.every(validCustom)) return { ok: false, error: 'invalidWorkout', detail: 'customExercises' }
  const known = new Set([...libraryIds, ...customs.map((c) => c.id)])
  for (const w of parsed.workouts as unknown[]) {
    if (!isObj(w) || typeof w.name !== 'string' || !w.name.trim() || !Array.isArray(w.exercises)) return { ok: false, error: 'invalidWorkout' }
    if (!(w.weekday === null || isInt(w.weekday, 0, 6))) return { ok: false, error: 'invalidWorkout', detail: w.name }
    for (const e of w.exercises) {
      if (!validExercise(e)) return { ok: false, error: 'invalidWorkout', detail: w.name }
      if (!known.has(e.exerciseId)) return { ok: false, error: 'unknownExercise', detail: e.exerciseId }
    }
  }
  return { ok: true, program: parsed as unknown as ProgramFile }
}

/** Replaces the active program's workouts with the file's. History is untouched. */
export async function applyProgram(file: ProgramFile, database: FrameDB = db): Promise<Program> {
  return database.transaction('rw', [database.programs, database.templates, database.exercises], async () => {
    const now = Date.now()
    for (const c of file.customExercises ?? []) {
      if (!(await database.exercises.get(c.id))) await database.exercises.add({ ...c, isCustom: true, createdAt: now, updatedAt: now })
    }
    const programs = await database.programs.toArray()
    let program = programs.find((p) => p.isActive) ?? programs[0]
    if (program) {
      program = { ...program, name: file.name, isActive: true, updatedAt: now }
      await database.programs.put(program)
      await database.templates.where('programId').equals(program.id).delete()
    } else {
      program = { id: newId(), name: file.name, isActive: true, createdAt: now, updatedAt: now }
      await database.programs.add(program)
    }
    await database.templates.bulkAdd(templatesFromProgram(file, program.id, now, newId))
    return program
  })
}

/** Current active program as a program file (custom exercises included). */
export async function exportProgram(database: FrameDB = db): Promise<ProgramFile> {
  const programs = await database.programs.toArray()
  const program = programs.find((p) => p.isActive) ?? programs[0]
  const templates = program ? (await database.templates.where('programId').equals(program.id).toArray()).sort((a, b) => a.order - b.order) : []
  const ids = new Set(templates.flatMap((t) => t.exercises.map((e) => e.exerciseId)))
  const customs = (await database.exercises.bulkGet([...ids])).filter((e): e is Exercise => !!e && e.isCustom)
  return {
    format: PROGRAM_FORMAT,
    version: PROGRAM_VERSION,
    name: program?.name ?? 'Programa',
    customExercises: customs.map(({ isCustom: _c, createdAt: _a, updatedAt: _u, ...rest }) => {
      void [_c, _a, _u]
      return rest
    }),
    workouts: templates.map((t) => ({
      name: t.name,
      weekday: t.weekday,
      notes: t.notes,
      warmupNotes: t.warmupNotes,
      exercises: t.exercises.map(({ id: _id, ...rest }) => {
        void _id
        return rest
      }),
    })),
  }
}

export function programFileName(name: string, date = new Date()): string {
  const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'programa'
  const p = (n: number) => String(n).padStart(2, '0')
  return `frame-ficha-${slug}-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.json`
}
