import type { DeviceCheckReport } from '../domain/deviceCheck'
import { newId } from '../lib/id'
import { db, type FrameDB } from './db'

/**
 * Device check reports live in the meta table (no schema change), newest
 * first, so they travel with the backup file.
 */
export const REPORTS_KEY = 'deviceChecks'
export const FIRST_SEEN_KEY = 'deviceCheckFirstSeen'
export const PROBE_KEY = 'deviceCheckProbe'
export const MAX_REPORTS = 20

export async function listReports(database: FrameDB = db): Promise<DeviceCheckReport[]> {
  const row = await database.meta.get(REPORTS_KEY)
  return Array.isArray(row?.value) ? (row.value as DeviceCheckReport[]) : []
}

export async function createReport(
  env: Pick<DeviceCheckReport, 'appVersion' | 'userAgent' | 'standalone'>,
  database: FrameDB = db,
  now = Date.now(),
): Promise<DeviceCheckReport> {
  const report: DeviceCheckReport = { id: newId(), startedAt: now, updatedAt: now, ...env }
  await database.transaction('rw', database.meta, async () => {
    const list = await listReports(database)
    await database.meta.put({ key: REPORTS_KEY, value: [report, ...list].slice(0, MAX_REPORTS) })
  })
  return report
}

/** Applies a change to one report; returns the updated report or null. */
export async function updateReport(
  id: string,
  fn: (r: DeviceCheckReport) => DeviceCheckReport,
  database: FrameDB = db,
  now = Date.now(),
): Promise<DeviceCheckReport | null> {
  let out: DeviceCheckReport | null = null
  await database.transaction('rw', database.meta, async () => {
    const list = await listReports(database)
    const i = list.findIndex((r) => r.id === id)
    if (i < 0) return
    out = { ...fn(list[i]), id, updatedAt: now }
    const next = [...list]
    next[i] = out
    await database.meta.put({ key: REPORTS_KEY, value: next })
  })
  return out
}

/**
 * Writes a random value and reads it back through a new transaction; keeps
 * the first time this ran, so a later check shows how long data survived.
 */
export async function probeStorage(database: FrameDB = db, now = Date.now()): Promise<{ ok: boolean; firstSeenAt: number | null }> {
  try {
    const value = `${now}-${Math.random().toString(36).slice(2)}`
    await database.meta.put({ key: PROBE_KEY, value })
    const back = await database.meta.get(PROBE_KEY)
    let first = (await database.meta.get(FIRST_SEEN_KEY))?.value
    if (typeof first !== 'number') {
      first = now
      await database.meta.put({ key: FIRST_SEEN_KEY, value: now })
    }
    return { ok: back?.value === value, firstSeenAt: first as number }
  } catch {
    return { ok: false, firstSeenAt: null }
  }
}
