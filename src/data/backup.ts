import { withSettingsDefaults } from '../domain/defaults'
import type { Exercise, Program, Settings, WorkoutSession, WorkoutTemplate } from '../domain/types'
import { db, type FrameDB, type MetaRow } from './db'

/**
 * Full backup in a documented JSON format (see ARCHITECTURE.md, "Backup").
 * Restore validates everything before touching the database and replaces
 * all tables in one transaction, so a failed restore changes nothing.
 */

export const BACKUP_FORMAT = 'frame-backup'
export const BACKUP_VERSION = 1

export interface BackupData {
  exercises: Exercise[]
  programs: Program[]
  templates: WorkoutTemplate[]
  sessions: WorkoutSession[]
  settings: Settings[]
  meta: MetaRow[]
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  app: 'FRAME'
  exportedAt: string
  data: BackupData
}

export async function createBackup(database: FrameDB = db): Promise<BackupFile> {
  return database.transaction(
    'r',
    [database.exercises, database.programs, database.templates, database.sessions, database.settings, database.meta],
    async () => ({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      app: 'FRAME' as const,
      exportedAt: new Date().toISOString(),
      data: {
        exercises: await database.exercises.toArray(),
        programs: await database.programs.toArray(),
        templates: await database.templates.toArray(),
        sessions: await database.sessions.toArray(),
        settings: await database.settings.toArray(),
        meta: await database.meta.toArray(),
      },
    }),
  )
}

export type BackupError =
  | 'notJson'
  | 'wrongFormat'
  | 'newerVersion'
  | 'missingTable'
  | 'invalidRecord'

export type ValidationResult =
  | { ok: true; backup: BackupFile; counts: Record<keyof BackupData, number> }
  | { ok: false; error: BackupError; detail?: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const hasId = (v: unknown) => isObj(v) && typeof v.id === 'string' && v.id.length > 0

function checkSession(s: unknown): boolean {
  if (!hasId(s) || !isObj(s)) return false
  if (typeof s.startedAt !== 'number' || !Array.isArray(s.exercises)) return false
  return s.exercises.every(
    (e) =>
      isObj(e) &&
      typeof e.exerciseId === 'string' &&
      Array.isArray(e.sets) &&
      e.sets.every((x) => isObj(x) && typeof x.weightKg === 'number' && typeof x.reps === 'number'),
  )
}

export function validateBackup(text: string): ValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'notJson' }
  }
  if (!isObj(parsed) || parsed.format !== BACKUP_FORMAT || !isObj(parsed.data)) return { ok: false, error: 'wrongFormat' }
  if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) return { ok: false, error: 'newerVersion' }
  const d = parsed.data
  const tables: Array<keyof BackupData> = ['exercises', 'programs', 'templates', 'sessions', 'settings']
  for (const t of tables) if (!Array.isArray(d[t])) return { ok: false, error: 'missingTable', detail: t }
  const ex = d.exercises as unknown[]
  const tpl = d.templates as unknown[]
  const ses = d.sessions as unknown[]
  if (!ex.every((e) => hasId(e) && isObj(e) && typeof e.namePt === 'string'))
    return { ok: false, error: 'invalidRecord', detail: 'exercises' }
  if (!(d.programs as unknown[]).every(hasId)) return { ok: false, error: 'invalidRecord', detail: 'programs' }
  if (!tpl.every((t) => hasId(t) && isObj(t) && Array.isArray(t.exercises)))
    return { ok: false, error: 'invalidRecord', detail: 'templates' }
  if (!ses.every(checkSession)) return { ok: false, error: 'invalidRecord', detail: 'sessions' }
  const data: BackupData = {
    exercises: d.exercises as Exercise[],
    programs: d.programs as Program[],
    templates: d.templates as WorkoutTemplate[],
    sessions: d.sessions as WorkoutSession[],
    settings: (d.settings as Partial<Settings>[]).slice(0, 1).map((s) => withSettingsDefaults(s)),
    meta: Array.isArray(d.meta) ? (d.meta as MetaRow[]) : [],
  }
  const backup: BackupFile = { ...(parsed as unknown as BackupFile), data }
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])) as Record<keyof BackupData, number>
  return { ok: true, backup, counts }
}

export async function restoreBackup(backup: BackupFile, database: FrameDB = db): Promise<void> {
  const d = backup.data
  await database.transaction(
    'rw',
    [database.exercises, database.programs, database.templates, database.sessions, database.settings, database.meta],
    async () => {
      await Promise.all([
        database.exercises.clear(),
        database.programs.clear(),
        database.templates.clear(),
        database.sessions.clear(),
        database.settings.clear(),
        database.meta.clear(),
      ])
      await database.exercises.bulkPut(d.exercises)
      await database.programs.bulkPut(d.programs)
      await database.templates.bulkPut(d.templates)
      await database.sessions.bulkPut(d.sessions)
      if (d.settings.length) await database.settings.bulkPut(d.settings)
      if (d.meta.length) await database.meta.bulkPut(d.meta)
      // The restored data is exactly what this file holds, so its export time is the last backup.
      const exportedAt = Date.parse(backup.exportedAt)
      if (Number.isFinite(exportedAt)) await database.meta.put({ key: LAST_BACKUP_KEY, value: exportedAt })
    },
  )
}

/** meta key holding the time (ms) of the last backup export on this device. */
export const LAST_BACKUP_KEY = 'lastBackupAt'

/**
 * Records that a backup was exported. Called when the file is handed to the
 * browser: on iOS the share sheet can still be cancelled, which the app
 * cannot detect.
 */
export async function markBackupExported(at: number, database: FrameDB = db): Promise<void> {
  await database.meta.put({ key: LAST_BACKUP_KEY, value: at })
}

export async function getLastBackupAt(database: FrameDB = db): Promise<number | null> {
  const row = await database.meta.get(LAST_BACKUP_KEY)
  return typeof row?.value === 'number' ? row.value : null
}

export function backupFileName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `frame-backup-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.json`
}
