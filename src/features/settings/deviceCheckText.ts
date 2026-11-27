import { backgroundAway, CHECK_IDS, checkStatus, iosVersion, overallStatus, type CheckId, type CheckStatus, type DeviceCheckReport } from '../../domain/deviceCheck'
import { formatClock, formatDate, formatTime, t } from '../../i18n'

export const statusLabel = (s: CheckStatus) => t(`deviceCheck.status.${s}`)
export const statusBadge = (s: CheckStatus) => (s === 'pass' ? 'accent' : s === 'warn' ? 'warn' : s === 'fail' ? 'danger' : '')

export const yn = (v: boolean | null | undefined) => (v === true ? t('deviceCheck.yes') : v === false ? t('deviceCheck.no') : t('deviceCheck.unknown'))

export function formatBytes(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1).replace('.', ',')} GB`
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1).replace('.', ',')} MB`
  return `${Math.round(n / 1024)} KB`
}

/** Measured facts of one check, as short pt-BR lines. */
export function checkLines(r: DeviceCheckReport, id: CheckId): string[] {
  switch (id) {
    case 'sound': {
      const c = r.sound
      if (!c) return []
      const out = [t('deviceCheck.sound.heardNow', { v: yn(c.heardNow) })]
      if (c.heardNow) out.push(t('deviceCheck.sound.heardDelayed', { v: yn(c.heardDelayed) }))
      return out
    }
    case 'screen': {
      const c = r.screen
      if (!c) return []
      if (!c.supported) return [t('deviceCheck.screen.unsupported')]
      if (!c.acquired) return [t('deviceCheck.screen.notAcquired')]
      if (c.hidden) return [t('deviceCheck.screen.hidden')]
      if (c.releasedEarly) return [t('deviceCheck.screen.releasedEarly')]
      if (!c.completed) return []
      if (c.touched) return [t('deviceCheck.screen.touched')]
      return [t('deviceCheck.screen.passed', { time: formatClock(c.durationSec * 1000) })]
    }
    case 'storage': {
      const c = r.storage
      if (!c) return []
      const out = [t('deviceCheck.storage.persisted', { v: yn(c.persistedAfter) }), t('deviceCheck.storage.writeRead', { v: c.writeReadOk ? 'ok' : t('deviceCheck.no') })]
      if (c.usageBytes !== null) out.push(t('deviceCheck.storage.usage', { used: formatBytes(c.usageBytes), quota: formatBytes(c.quotaBytes) }))
      if (c.firstSeenAt !== null) out.push(t('deviceCheck.storage.firstSeen', { date: `${formatDate(c.firstSeenAt)} ${formatTime(c.firstSeenAt)}` }))
      return out
    }
    case 'background': {
      const c = r.background
      if (!c || c.returnedAt === undefined) return []
      const away = backgroundAway(c) ?? 0
      const out = [t('deviceCheck.background.away', { time: formatClock(away) })]
      if (c.remainingOnReturnMs !== undefined) {
        out.push(
          c.remainingOnReturnMs <= 0
            ? t('deviceCheck.background.countdownDone', { time: formatClock(-c.remainingOnReturnMs) })
            : t('deviceCheck.background.countdownLeft', { time: formatClock(c.remainingOnReturnMs) }),
        )
      }
      out.push(c.reloaded ? t('deviceCheck.background.reloaded') : t('deviceCheck.background.notReloaded'))
      if (c.audioStateOnReturn) out.push(t('deviceCheck.background.audioState', { v: c.audioStateOnReturn }))
      if (c.heardAfterReturn !== undefined) out.push(t('deviceCheck.background.heardAfter', { v: yn(c.heardAfterReturn) }))
      return out
    }
  }
}

export const checkTitle = (id: CheckId) => t(`deviceCheck.${id}.title`)

/** Plain-text summary to paste into a chat or a note. */
export function reportText(r: DeviceCheckReport): string {
  const head = [
    `FRAME · ${t('deviceCheck.title')}`,
    `${formatDate(r.updatedAt)} ${formatTime(r.updatedAt)} · ${t('deviceCheck.version')} ${r.appVersion} · ${iosVersion(r.userAgent) ?? t('deviceCheck.systemUnknown')} · ${t('deviceCheck.installed')}: ${yn(r.standalone)}`,
    `${t('deviceCheck.overall')}: ${statusLabel(overallStatus(r))}`,
    '',
  ]
  const body = CHECK_IDS.flatMap((id) => {
    const lines = checkLines(r, id)
    return [`${checkTitle(id)}: ${statusLabel(checkStatus(r, id))}`, ...lines.map((l) => `  - ${l}`)]
  })
  return [...head, ...body, '', r.userAgent].join('\n')
}
