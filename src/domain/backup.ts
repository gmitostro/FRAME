/**
 * Backup reminder rule (pure). Data lives only on this device, so the app
 * reminds the user to export when finished workouts are not in any backup
 * yet and the last backup is old (or there was never one).
 */

export const BACKUP_REMINDER_DAYS = 7
const DAY_MS = 86_400_000

export interface BackupStatus {
  lastBackupAt: number | null
  /** Whole days since the last backup; null when there was never one. */
  daysSince: number | null
  /** Finished workouts that ended after the last backup. */
  unsavedSessions: number
  /** True when the reminder should be shown. */
  stale: boolean
}

export function backupStatus(
  lastBackupAt: number | null,
  sessionEndTimes: number[],
  now: number,
  thresholdDays = BACKUP_REMINDER_DAYS,
): BackupStatus {
  const unsavedSessions = sessionEndTimes.filter((t) => lastBackupAt === null || t > lastBackupAt).length
  const daysSince = lastBackupAt === null ? null : Math.max(0, Math.floor((now - lastBackupAt) / DAY_MS))
  const old = lastBackupAt === null || now - lastBackupAt >= thresholdDays * DAY_MS
  return { lastBackupAt, daysSince, unsavedSessions, stale: unsavedSessions > 0 && old }
}
