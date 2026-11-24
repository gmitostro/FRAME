import type { Program, WorkoutTemplate } from '../../domain/types'
import type { ProgramFile } from '../program'
import { FRFB_V1 } from './frfb-v1'

/** Pure conversion from a program file to workout templates. */
export function templatesFromProgram(file: ProgramFile, programId: string, now: number, makeId: () => string): WorkoutTemplate[] {
  return file.workouts.map((w, order) => ({
    id: makeId(),
    programId,
    name: w.name.trim(),
    weekday: w.weekday,
    order,
    notes: w.notes,
    warmupNotes: w.warmupNotes,
    exercises: w.exercises.map((e) => ({ ...e, id: makeId() })),
    createdAt: now,
    updatedAt: now,
  }))
}

/** First-run program: the user's FRFB V1 ficha. */
export function seedProgram(now: number, newId: () => string, file: ProgramFile = FRFB_V1): { program: Program; templates: WorkoutTemplate[] } {
  const program: Program = { id: newId(), name: file.name, isActive: true, createdAt: now, updatedAt: now }
  return { program, templates: templatesFromProgram(file, program.id, now, newId) }
}
