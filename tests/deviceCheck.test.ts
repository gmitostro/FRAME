import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBackup } from '../src/data/backup'
import { FrameDB } from '../src/data/db'
import { createReport, FIRST_SEEN_KEY, listReports, MAX_REPORTS, probeStorage, updateReport } from '../src/data/deviceCheck'
import * as D from '../src/domain/deviceCheck'
import { reportText } from '../src/features/settings/deviceCheckText'

const env = { appVersion: '0.3.0-alpha.2', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2_1 like Mac OS X) AppleWebKit/605.1.15', standalone: true }
const base: D.DeviceCheckReport = { id: 'r', startedAt: 0, updatedAt: 0, ...env }

describe('device check status rules', () => {
  it('sound: fail without sound after a tap, warn when only the tapped sound plays', () => {
    expect(D.soundStatus(undefined)).toBe('pending')
    expect(D.soundStatus({ heardNow: false, at: 1 })).toBe('fail')
    expect(D.soundStatus({ heardNow: true, at: 1 })).toBe('pending')
    expect(D.soundStatus({ heardNow: true, heardDelayed: false, at: 1 })).toBe('warn')
    expect(D.soundStatus({ heardNow: true, heardDelayed: true, at: 1 })).toBe('pass')
  })

  it('screen: fails when the lock is missing, released or the screen went off; touch makes it inconclusive', () => {
    const ok: D.ScreenCheck = { supported: true, acquired: true, durationSec: 120, completed: true, hidden: false, releasedEarly: false, touched: false, at: 1 }
    expect(D.screenStatus(ok)).toBe('pass')
    expect(D.screenStatus({ ...ok, supported: false })).toBe('fail')
    expect(D.screenStatus({ ...ok, acquired: false })).toBe('fail')
    expect(D.screenStatus({ ...ok, completed: false, hidden: true })).toBe('fail')
    expect(D.screenStatus({ ...ok, completed: false, releasedEarly: true })).toBe('fail')
    expect(D.screenStatus({ ...ok, touched: true })).toBe('warn')
    expect(D.screenStatus({ ...ok, completed: false })).toBe('pending')
  })

  it('storage: pass only when persisted and readable', () => {
    const ok: D.StorageCheck = { persistedBefore: false, persistedAfter: true, writeReadOk: true, usageBytes: 1, quotaBytes: 2, firstSeenAt: 1, at: 1 }
    expect(D.storageStatus(ok)).toBe('pass')
    expect(D.storageStatus({ ...ok, persistedAfter: false })).toBe('warn')
    expect(D.storageStatus({ ...ok, persistedAfter: null })).toBe('warn')
    expect(D.storageStatus({ ...ok, writeReadOk: false })).toBe('fail')
  })

  it('background: needs 10 s away and the sound answer; reload or no sound warns', () => {
    const c: D.BackgroundCheck = { startedAt: 0, durationMs: 30_000, hiddenAt: 1_000, returnedAt: 41_000, heardAfterReturn: true, at: 1 }
    expect(D.backgroundStatus(c)).toBe('pass')
    expect(D.backgroundAway(c)).toBe(40_000)
    expect(D.backgroundStatus({ ...c, returnedAt: undefined })).toBe('pending')
    expect(D.backgroundStatus({ ...c, returnedAt: 5_000 })).toBe('pending')
    expect(D.backgroundStatus({ ...c, heardAfterReturn: undefined })).toBe('pending')
    expect(D.backgroundStatus({ ...c, heardAfterReturn: false })).toBe('warn')
    // Reloaded: hiddenAt may be lost; time away counts from the start.
    expect(D.backgroundStatus({ ...c, hiddenAt: undefined, reloaded: true })).toBe('warn')
    expect(D.backgroundRemainingMs(c, 41_000)).toBe(-11_000)
  })

  it('overall: fail beats pending beats warn', () => {
    const pass = {
      ...base,
      sound: { heardNow: true, heardDelayed: true, at: 1 },
      screen: { supported: true, acquired: true, durationSec: 60, completed: true, hidden: false, releasedEarly: false, touched: false, at: 1 },
      storage: { persistedBefore: true, persistedAfter: true, writeReadOk: true, usageBytes: null, quotaBytes: null, firstSeenAt: null, at: 1 },
      background: { startedAt: 0, durationMs: 30_000, hiddenAt: 0, returnedAt: 40_000, heardAfterReturn: true, at: 1 },
    }
    expect(D.overallStatus(pass)).toBe('pass')
    expect(D.overallStatus({ ...pass, sound: { heardNow: true, heardDelayed: false, at: 1 } })).toBe('warn')
    expect(D.overallStatus({ ...pass, background: undefined })).toBe('pending')
    expect(D.overallStatus({ ...pass, background: undefined, sound: { heardNow: false, at: 1 } })).toBe('fail')
  })

  it('reads the iOS version from the user agent', () => {
    expect(D.iosVersion(env.userAgent)).toBe('iOS 18.2.1')
    expect(D.iosVersion('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)')).toBe('iOS 17.4')
    expect(D.iosVersion('Mozilla/5.0 (X11; Linux x86_64)')).toBeNull()
  })

  it('writes a plain-text summary with every check', () => {
    const text = reportText({ ...base, sound: { heardNow: true, heardDelayed: false, at: 1 } })
    expect(text).toContain('Som do fim do descanso: Atenção')
    expect(text).toContain('Tela ligada durante o treino: Pendente')
    expect(text).toContain('iOS 18.2.1')
    expect(text).toContain('Sem toque (5 s depois): não')
  })
})

describe('device check storage', () => {
  let db: FrameDB
  let n = 0
  beforeEach(async () => {
    db = new FrameDB(`device-${++n}`)
    await db.open()
  })
  afterEach(async () => {
    await db.delete()
  })

  it('keeps reports newest first, updates in place and caps the list', async () => {
    const a = await createReport(env, db, 1)
    const b = await createReport(env, db, 2)
    expect((await listReports(db)).map((r) => r.id)).toEqual([b.id, a.id])
    const updated = await updateReport(a.id, (r) => ({ ...r, sound: { heardNow: true, at: 3 } }), db, 3)
    expect(updated?.updatedAt).toBe(3)
    const list = await listReports(db)
    expect(list[1].sound?.heardNow).toBe(true)
    expect(list[0].sound).toBeUndefined()
    expect(await updateReport('missing', (r) => r, db)).toBeNull()
    for (let i = 0; i < MAX_REPORTS + 5; i++) await createReport(env, db, 10 + i)
    expect((await listReports(db)).length).toBe(MAX_REPORTS)
  })

  it('probes storage and keeps the first-seen time', async () => {
    expect(await probeStorage(db, 100)).toEqual({ ok: true, firstSeenAt: 100 })
    expect(await probeStorage(db, 200)).toEqual({ ok: true, firstSeenAt: 100 })
    expect((await db.meta.get(FIRST_SEEN_KEY))?.value).toBe(100)
  })

  it('travels in the backup file', async () => {
    const r = await createReport(env, db, 1)
    const backup = await createBackup(db)
    const row = backup.data.meta.find((m) => m.key === 'deviceChecks')
    expect((row?.value as D.DeviceCheckReport[])[0].id).toBe(r.id)
  })
})
