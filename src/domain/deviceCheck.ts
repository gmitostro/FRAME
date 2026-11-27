/**
 * Device check (v0.3.0-alpha.2): a guided test of the platform features the
 * workout depends on, run on the real phone. Each check stores what was
 * measured and, where a person has to judge (sound), their answer. Status is
 * derived from those facts here, so the rules are testable and explicit.
 */

export type CheckStatus = 'pending' | 'pass' | 'warn' | 'fail'
export type CheckId = 'sound' | 'screen' | 'storage' | 'background'
export const CHECK_IDS: CheckId[] = ['sound', 'screen', 'storage', 'background']

export interface SoundCheck {
  /** Two tones played right after a tap. */
  heardNow?: boolean
  /** Two tones played 5 s later, outside a tap, as at the end of a rest. */
  heardDelayed?: boolean
  audioState?: string
  at: number
}

export interface ScreenCheck {
  supported: boolean
  acquired: boolean
  durationSec: number
  /** The test ran for its full duration. */
  completed: boolean
  /** The page was hidden (screen locked or app left) during the test. */
  hidden: boolean
  /** The browser released the lock before the end, while visible. */
  releasedEarly: boolean
  /** The screen was touched, which resets auto-lock and voids the test. */
  touched: boolean
  at: number
}

export interface StorageCheck {
  persistedBefore: boolean | null
  persistedAfter: boolean | null
  writeReadOk: boolean
  usageBytes: number | null
  quotaBytes: number | null
  /** When this device first ran a storage check; shows data survived. */
  firstSeenAt: number | null
  at: number
}

export interface BackgroundCheck {
  startedAt: number
  /** Countdown length, like a rest timer. */
  durationMs: number
  hiddenAt?: number
  returnedAt?: number
  /** The page was reloaded (iOS discarded it) and the test resumed from the database. */
  reloaded?: boolean
  /** Audio context state on return ("interrupted" is common on iOS). */
  audioStateOnReturn?: string
  /** Remaining time shown on return, from timestamps. */
  remainingOnReturnMs?: number
  /** Sound played on the first tap after returning. */
  heardAfterReturn?: boolean
  at: number
}

export interface DeviceCheckReport {
  id: string
  startedAt: number
  updatedAt: number
  appVersion: string
  userAgent: string
  /** Opened from the home screen icon (installed PWA). */
  standalone: boolean
  sound?: SoundCheck
  screen?: ScreenCheck
  storage?: StorageCheck
  background?: BackgroundCheck
}

/** Minimum time away for the background check to count. */
export const MIN_BACKGROUND_MS = 10_000

export function soundStatus(c?: SoundCheck): CheckStatus {
  if (!c || c.heardNow === undefined) return 'pending'
  if (c.heardNow === false) return 'fail'
  if (c.heardDelayed === undefined) return 'pending'
  return c.heardDelayed ? 'pass' : 'warn'
}

export function screenStatus(c?: ScreenCheck): CheckStatus {
  if (!c) return 'pending'
  if (!c.supported || !c.acquired) return 'fail'
  if (c.hidden || c.releasedEarly) return 'fail'
  if (!c.completed) return 'pending'
  // Touching resets auto-lock, so a pass is not conclusive.
  return c.touched ? 'warn' : 'pass'
}

export function storageStatus(c?: StorageCheck): CheckStatus {
  if (!c) return 'pending'
  if (!c.writeReadOk) return 'fail'
  return c.persistedAfter === true ? 'pass' : 'warn'
}

export function backgroundAway(c: BackgroundCheck): number | null {
  if (c.returnedAt === undefined) return null
  return c.returnedAt - (c.hiddenAt ?? c.startedAt)
}

export function backgroundStatus(c?: BackgroundCheck): CheckStatus {
  if (!c || c.returnedAt === undefined) return 'pending'
  const away = backgroundAway(c) ?? 0
  if (c.hiddenAt === undefined && !c.reloaded) return 'pending'
  if (away < MIN_BACKGROUND_MS) return 'pending'
  if (c.heardAfterReturn === undefined) return 'pending'
  if (c.reloaded || !c.heardAfterReturn) return 'warn'
  return 'pass'
}

export function checkStatus(r: DeviceCheckReport, id: CheckId): CheckStatus {
  switch (id) {
    case 'sound':
      return soundStatus(r.sound)
    case 'screen':
      return screenStatus(r.screen)
    case 'storage':
      return storageStatus(r.storage)
    case 'background':
      return backgroundStatus(r.background)
  }
}

export function reportStatuses(r: DeviceCheckReport): Record<CheckId, CheckStatus> {
  return Object.fromEntries(CHECK_IDS.map((id) => [id, checkStatus(r, id)])) as Record<CheckId, CheckStatus>
}

/** Overall result: any fail fails; any pending is incomplete; any warn warns. */
export function overallStatus(r: DeviceCheckReport): CheckStatus {
  const s = Object.values(reportStatuses(r))
  if (s.includes('fail')) return 'fail'
  if (s.includes('pending')) return 'pending'
  if (s.includes('warn')) return 'warn'
  return 'pass'
}

/** Remaining time of the background countdown, from timestamps only. */
export function backgroundRemainingMs(c: BackgroundCheck, now: number): number {
  return c.startedAt + c.durationMs - now
}

/** "iOS 18.2" from a user agent, or null. */
export function iosVersion(ua: string): string | null {
  const m = /OS (\d+)[_.](\d+)(?:[_.](\d+))? like Mac OS X/.exec(ua)
  if (!m) return null
  return `iOS ${m[1]}.${m[2]}${m[3] ? `.${m[3]}` : ''}`
}
