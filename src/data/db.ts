import Dexie, { type EntityTable } from 'dexie'
import { defaultSettings } from '../domain/defaults'
import type { Exercise, Program, Settings, WorkoutSession, WorkoutTemplate } from '../domain/types'
import { newId } from '../lib/id'
import { EXERCISE_SEED_VERSION, seedExercises } from './seed/exercises'
import { seedProgram } from './seed/program'

export interface MetaRow {
  key: string
  value: unknown
}

/**
 * Local database. Schema changes must add a new db.version(n) block with an
 * upgrade() function; never edit an existing version. See ARCHITECTURE.md.
 */
export class FrameDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  programs!: EntityTable<Program, 'id'>
  templates!: EntityTable<WorkoutTemplate, 'id'>
  sessions!: EntityTable<WorkoutSession, 'id'>
  settings!: EntityTable<Settings, 'id'>
  meta!: EntityTable<MetaRow, 'key'>

  constructor(name = 'frame') {
    super(name)
    this.version(1).stores({
      exercises: 'id, namePt, primaryMuscle, equipment, category, isCustom',
      programs: 'id, isActive',
      templates: 'id, programId, weekday, order',
      sessions: 'id, status, startedAt, templateId, *exerciseIds',
      settings: 'id',
      meta: 'key',
    })

    this.on('populate', (tx) => {
      const now = Date.now()
      const { program, templates } = seedProgram(now, newId)
      tx.table('exercises').bulkAdd(seedExercises(now))
      tx.table('programs').add(program)
      tx.table('templates').bulkAdd(templates)
      tx.table('settings').add(defaultSettings(now))
      tx.table('meta').add({ key: 'exerciseSeedVersion', value: EXERCISE_SEED_VERSION })
    })
  }
}

export const db = new FrameDB()

/** Adds library exercises introduced by newer app versions. */
export async function syncExerciseSeed(database: FrameDB = db): Promise<number> {
  const row = await database.meta.get('exerciseSeedVersion')
  if (typeof row?.value === 'number' && row.value >= EXERCISE_SEED_VERSION) return 0
  const seeds = seedExercises(Date.now())
  let added = 0
  await database.transaction('rw', database.exercises, database.meta, async () => {
    const existing = new Set(await database.exercises.toCollection().primaryKeys())
    const missing = seeds.filter((e) => !existing.has(e.id))
    if (missing.length) await database.exercises.bulkAdd(missing)
    added = missing.length
    await database.meta.put({ key: 'exerciseSeedVersion', value: EXERCISE_SEED_VERSION })
  })
  return added
}

/** Asks the browser not to evict local data (important on iOS). */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return null
  }
}
