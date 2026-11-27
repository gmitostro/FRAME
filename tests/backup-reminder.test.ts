import { describe, expect, it } from 'vitest'
import { BACKUP_REMINDER_DAYS, backupStatus } from '../src/domain/backup'

const DAY = 86_400_000
const now = 100 * DAY

describe('backup reminder', () => {
  it('stays quiet with no finished workouts', () => {
    expect(backupStatus(null, [], now).stale).toBe(false)
    expect(backupStatus(now - 30 * DAY, [], now).stale).toBe(false)
  })

  it('asks for a first backup as soon as a workout exists', () => {
    expect(backupStatus(null, [now - DAY], now)).toEqual({ lastBackupAt: null, daysSince: null, unsavedSessions: 1, stale: true })
  })

  it('stays quiet when every workout is already in the backup, however old', () => {
    const st = backupStatus(now - 30 * DAY, [now - 40 * DAY, now - 31 * DAY], now)
    expect(st).toMatchObject({ daysSince: 30, unsavedSessions: 0, stale: false })
  })

  it('stays quiet when the backup is recent, even with new workouts', () => {
    const st = backupStatus(now - 3 * DAY, [now - DAY], now)
    expect(st).toMatchObject({ daysSince: 3, unsavedSessions: 1, stale: false })
  })

  it('reminds when the backup is old and workouts were added after it', () => {
    const last = now - BACKUP_REMINDER_DAYS * DAY
    const st = backupStatus(last, [last - DAY, last + DAY, now - 1000], now)
    expect(st).toMatchObject({ daysSince: BACKUP_REMINDER_DAYS, unsavedSessions: 2, stale: true })
    expect(backupStatus(last + 1, [now - 1000], now).stale).toBe(false)
  })
})
