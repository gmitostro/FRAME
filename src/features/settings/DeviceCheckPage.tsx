import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardCopy, Download, Info, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNow } from '../../app/hooks'
import { PageHeader } from '../../components/PageHeader'
import { useToast } from '../../components/Toast'
import { requestPersistentStorage } from '../../data/db'
import { createReport, listReports, probeStorage, updateReport } from '../../data/deviceCheck'
import {
  backgroundAway,
  backgroundRemainingMs,
  checkStatus,
  iosVersion,
  MIN_BACKGROUND_MS,
  overallStatus,
  type BackgroundCheck,
  type CheckId,
  type DeviceCheckReport,
  type ScreenCheck,
} from '../../domain/deviceCheck'
import { downloadText } from '../../lib/download'
import { audioState, playRestEndSound, unlockAudio } from '../../lib/feedback'
import { newId } from '../../lib/id'
import { formatClock, formatDate, formatTime, t } from '../../i18n'
import { useSafe } from '../shared'
import { checkLines, checkTitle, reportText, statusBadge, statusLabel, yn } from './deviceCheckText'

declare const __APP_VERSION__: string

/** Identifies this page load, to tell a real reload from leaving the screen. */
const PAGE_ID = newId()
const BACKGROUND_MS = 30_000
const DELAYED_SOUND_MS = 5_000
const SCREEN_OPTIONS = [60, 120, 300]

function isStandalone(): boolean {
  try {
    return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

export function DeviceCheckPage() {
  const reports = useLiveQuery(() => listReports(), [])
  const report = reports?.[0]
  const safe = useSafe()
  const toast = useToast()

  /** The current report, created on the first action. */
  const ensure = useCallback(async (): Promise<string> => {
    const current = (await listReports())[0]
    if (current) return current.id
    return (await createReport({ appVersion: __APP_VERSION__, userAgent: navigator.userAgent, standalone: isStandalone() })).id
  }, [])

  const save = useCallback(
    (fn: (r: DeviceCheckReport) => DeviceCheckReport) =>
      safe(async () => {
        const id = await ensure()
        await updateReport(id, fn)
      }),
    [ensure, safe],
  )

  async function newRun() {
    await safe(() => createReport({ appVersion: __APP_VERSION__, userAgent: navigator.userAgent, standalone: isStandalone() }))
  }

  async function copySummary() {
    if (!report) return
    const text = reportText(report)
    try {
      await navigator.clipboard.writeText(text)
      toast.show(t('deviceCheck.copied'))
    } catch {
      downloadText(`frame-verificacao-${formatDate(report.updatedAt).replaceAll('/', '-')}.txt`, text, 'text/plain')
    }
  }

  function exportJson() {
    if (!report) return
    downloadText(`frame-verificacao-${formatDate(report.updatedAt).replaceAll('/', '-')}.json`, JSON.stringify({ format: 'frame-device-check', version: 1, report }, null, 2))
    toast.show(t('deviceCheck.exported'))
  }

  if (reports === undefined) return null
  const standalone = report ? report.standalone : isStandalone()
  const ua = report?.userAgent ?? navigator.userAgent

  return (
    <div className="page">
      <PageHeader title={t('deviceCheck.title')} eyebrow={t('deviceCheck.eyebrow')} back="/ajustes" />
      <p className="small muted" style={{ marginTop: 0 }}>
        {t('deviceCheck.intro')}
      </p>

      <section className="section">
        <div className="section-title">{t('deviceCheck.device')}</div>
        <div className="card">
          <Line label={t('deviceCheck.version')} value={report?.appVersion ?? __APP_VERSION__} />
          <Line label={t('deviceCheck.system')} value={iosVersion(ua) ?? t('deviceCheck.systemUnknown')} />
          <Line label={t('deviceCheck.installed')} value={yn(standalone)} />
          {!standalone && (
            <div className="notice warn">
              <Info size={16} />
              <span>{t('deviceCheck.notInstalledWarn')}</span>
            </div>
          )}
          {report && (
            <div className="row between">
              <span className="small">{t('deviceCheck.overall')}</span>
              <StatusBadge report={report} />
            </div>
          )}
        </div>
      </section>

      <SoundCard report={report} save={save} />
      <ScreenCard report={report} save={save} />
      <StorageCard report={report} save={save} />
      <BackgroundCard report={report} save={save} />

      {report && (
        <section className="section">
          <div className="card">
            <button className="btn btn-block" onClick={copySummary}>
              <ClipboardCopy size={18} /> {t('deviceCheck.copy')}
            </button>
            <button className="btn btn-block" onClick={exportJson}>
              <Download size={18} /> {t('deviceCheck.exportJson')}
            </button>
            <button className="btn btn-ghost btn-block" onClick={newRun}>
              <RotateCcw size={18} /> {t('deviceCheck.newRun')}
            </button>
          </div>
        </section>
      )}

      {reports.length > 1 && (
        <section className="section">
          <div className="section-title">{t('deviceCheck.history')}</div>
          <div className="card">
            {reports.slice(1).map((r) => (
              <div key={r.id} className="row between" data-testid="device-check-history">
                <span className="small">
                  {formatDate(r.updatedAt)} {formatTime(r.updatedAt)} · {r.appVersion}
                </span>
                <StatusBadge report={r} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

type Save = (fn: (r: DeviceCheckReport) => DeviceCheckReport) => Promise<unknown>
interface CardProps {
  report: DeviceCheckReport | undefined
  save: Save
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="row between">
      <span className="small muted">{label}</span>
      <span className="small">{value}</span>
    </div>
  )
}

function StatusBadge({ report, id }: { report: DeviceCheckReport; id?: CheckId }) {
  const s = id ? checkStatus(report, id) : overallStatus(report)
  return <span className={`badge ${statusBadge(s)}`}>{statusLabel(s)}</span>
}

function CheckCard({ id, report, howTo, children }: { id: CheckId; report: DeviceCheckReport | undefined; howTo: string; children: ReactNode }) {
  const lines = report ? checkLines(report, id) : []
  return (
    <section className="section" data-check={id}>
      <div className="card">
        <div className="row between">
          <span className="card-title">{checkTitle(id)}</span>
          {report ? <StatusBadge report={report} id={id} /> : <span className="badge">{statusLabel('pending')}</span>}
        </div>
        <span className="small muted">{howTo}</span>
        {lines.length > 0 && (
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }} data-testid={`lines-${id}`}>
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        {children}
      </div>
    </section>
  )
}

function Hint({ kind, children }: { kind: 'warn' | 'accent' | ''; children: ReactNode }) {
  return (
    <div className={`notice ${kind}`}>
      <Info size={16} />
      <span>{children}</span>
    </div>
  )
}

function YesNo({ onAnswer }: { onAnswer: (heard: boolean) => void }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="small">{t('deviceCheck.heardQuestion')}</span>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary grow" onClick={() => onAnswer(true)}>
          {t('deviceCheck.heardYes')}
        </button>
        <button className="btn grow" onClick={() => onAnswer(false)}>
          {t('deviceCheck.heardNo')}
        </button>
      </div>
    </div>
  )
}

// ---------- Sound ----------

function SoundCard({ report, save }: CardProps) {
  const c = report?.sound
  const [phase, setPhase] = useState<'idle' | 'askNow' | 'countdown' | 'askDelayed'>('idle')
  const [playAt, setPlayAt] = useState(0)
  const now = useNow(250, phase === 'countdown')

  useEffect(() => {
    if (phase !== 'countdown') return
    // Plays outside a user gesture, as the rest-end alert does.
    const h = window.setTimeout(() => {
      playRestEndSound()
      setPhase('askDelayed')
    }, Math.max(0, playAt - Date.now()))
    return () => window.clearTimeout(h)
  }, [phase, playAt])

  const playNow = () => {
    unlockAudio()
    playRestEndSound()
    setPhase('askNow')
  }
  const answerNow = (heard: boolean) => {
    setPhase('idle')
    void save((r) => ({ ...r, sound: { heardNow: heard, audioState: audioState() ?? undefined, at: Date.now() } }))
  }
  const answerDelayed = (heard: boolean) => {
    setPhase('idle')
    void save((r) => ({ ...r, sound: { ...(r.sound ?? { at: Date.now() }), heardDelayed: heard, at: Date.now() } }))
  }
  const status = report ? checkStatus(report, 'sound') : 'pending'

  return (
    <CheckCard id="sound" report={report} howTo={t('deviceCheck.sound.howTo')}>
      {phase === 'askNow' && <YesNo onAnswer={answerNow} />}
      {phase === 'askDelayed' && <YesNo onAnswer={answerDelayed} />}
      {phase === 'countdown' && <span className="small">{t('deviceCheck.sound.waiting', { n: Math.max(0, Math.ceil((playAt - now) / 1000)) })}</span>}
      {phase === 'idle' && c?.heardNow === undefined && (
        <>
          <span className="small">{t('deviceCheck.sound.stepNow')}</span>
          <button className="btn btn-block" onClick={playNow}>
            {t('deviceCheck.sound.playNow')}
          </button>
        </>
      )}
      {phase === 'idle' && c?.heardNow === true && c.heardDelayed === undefined && (
        <>
          <span className="small">{t('deviceCheck.sound.stepDelayed')}</span>
          <button
            className="btn btn-block"
            onClick={() => {
              unlockAudio()
              setPlayAt(Date.now() + DELAYED_SOUND_MS)
              setPhase('countdown')
            }}
          >
            {t('deviceCheck.sound.playDelayed')}
          </button>
        </>
      )}
      {phase === 'idle' && status === 'fail' && <Hint kind="warn">{t('deviceCheck.sound.failHint')}</Hint>}
      {phase === 'idle' && status === 'warn' && <Hint kind="warn">{t('deviceCheck.sound.warnHint')}</Hint>}
      {phase === 'idle' && (status === 'pass' || status === 'warn' || status === 'fail') && (
        <button className="btn btn-ghost btn-block" onClick={() => void save((r) => ({ ...r, sound: undefined }))}>
          {t('deviceCheck.redo')}
        </button>
      )}
    </CheckCard>
  )
}

// ---------- Screen on (Wake Lock) ----------

interface ScreenRun {
  endAt: number
  durationSec: number
  sentinel: WakeLockSentinel
  touched: boolean
  stopping: boolean
}

function ScreenCard({ report, save }: CardProps) {
  const c = report?.screen
  const [durationSec, setDurationSec] = useState(120)
  const runRef = useRef<ScreenRun | null>(null)
  const [endAt, setEndAt] = useState<number | null>(null)
  const running = endAt !== null
  const now = useNow(250, running)
  // Stable finish: a new identity must not end a running test via cleanup.
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  }, [save])

  const finish = useCallback(
    (patch: Partial<ScreenCheck> | null) => {
      const run = runRef.current
      if (!run) return
      run.stopping = true
      runRef.current = null
      setEndAt(null)
      void run.sentinel.release().catch(() => {})
      if (patch) void saveRef.current((r) => ({ ...r, screen: { ...(r.screen as ScreenCheck), ...patch, touched: run.touched || !!patch.touched, at: Date.now() } }))
    },
    [],
  )

  async function start() {
    const base: ScreenCheck = { supported: 'wakeLock' in navigator, acquired: false, durationSec, completed: false, hidden: false, releasedEarly: false, touched: false, at: Date.now() }
    if (!base.supported) {
      await save((r) => ({ ...r, screen: base }))
      return
    }
    let sentinel: WakeLockSentinel
    try {
      sentinel = await navigator.wakeLock.request('screen')
    } catch {
      await save((r) => ({ ...r, screen: base }))
      return
    }
    const run: ScreenRun = { endAt: Date.now() + durationSec * 1000, durationSec, sentinel, touched: false, stopping: false }
    runRef.current = run
    sentinel.addEventListener('release', () => {
      // Hidden pages lose the lock too; that case is reported as hidden.
      if (!run.stopping && document.visibilityState === 'visible') finish({ releasedEarly: true })
    })
    setEndAt(run.endAt)
    await save((r) => ({ ...r, screen: { ...base, acquired: true } }))
  }

  useEffect(() => {
    if (!running) return
    const onTouch = () => {
      if (runRef.current) runRef.current.touched = true
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') finish({ hidden: true })
    }
    window.addEventListener('pointerdown', onTouch, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pointerdown', onTouch)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [running, finish])

  useEffect(() => {
    if (endAt !== null && now >= endAt) finish({ completed: true })
  }, [endAt, now, finish])

  // Leaving the screen ends the test without a result.
  useEffect(() => () => finish(null), [finish])

  const status = report ? checkStatus(report, 'screen') : 'pending'
  const interrupted = !running && c && c.supported && c.acquired && !c.completed && !c.hidden && !c.releasedEarly
  const remaining = endAt !== null ? endAt - now : 0

  return (
    <CheckCard id="screen" report={report} howTo={t('deviceCheck.screen.howTo')}>
      {running ? (
        <>
          <div className="num" style={{ fontSize: 40, fontWeight: 650, textAlign: 'center' }} data-testid="screen-countdown">
            {formatClock(remaining)}
          </div>
          <span className="small">{t('deviceCheck.screen.running', { time: formatClock(remaining) })}</span>
          <button className="btn btn-ghost btn-block" onClick={() => finish(null)}>
            {t('deviceCheck.cancel')}
          </button>
        </>
      ) : (
        <>
          {interrupted && <Hint kind="warn">{t('deviceCheck.screen.interrupted')}</Hint>}
          <span className="field-label">{t('deviceCheck.screen.duration')}</span>
          <div className="segmented">
            {SCREEN_OPTIONS.map((s) => (
              <button key={s} aria-pressed={durationSec === s} onClick={() => setDurationSec(s)}>
                {formatClock(s * 1000)}
              </button>
            ))}
          </div>
          <button className={`btn btn-block ${status === 'pending' ? 'btn-primary' : ''}`} onClick={start}>
            {status === 'pending' ? t('deviceCheck.screen.start') : t('deviceCheck.redo')}
          </button>
        </>
      )}
    </CheckCard>
  )
}

// ---------- Persistent storage ----------

function StorageCard({ report, save }: CardProps) {
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true)
    try {
      let before: boolean | null = null
      try {
        before = navigator.storage?.persisted ? await navigator.storage.persisted() : null
      } catch {
        before = null
      }
      const after = await requestPersistentStorage()
      let usage: number | null = null
      let quota: number | null = null
      try {
        const est = await navigator.storage?.estimate?.()
        usage = est?.usage ?? null
        quota = est?.quota ?? null
      } catch {
        // not available
      }
      const probe = await probeStorage()
      await save((r) => ({
        ...r,
        storage: { persistedBefore: before, persistedAfter: after, writeReadOk: probe.ok, usageBytes: usage, quotaBytes: quota, firstSeenAt: probe.firstSeenAt, at: Date.now() },
      }))
    } finally {
      setBusy(false)
    }
  }
  const status = report ? checkStatus(report, 'storage') : 'pending'
  return (
    <CheckCard id="storage" report={report} howTo={t('deviceCheck.storage.howTo')}>
      {status === 'warn' && <Hint kind="warn">{t('deviceCheck.storage.notPersistedHint')}</Hint>}
      {status === 'fail' && <Hint kind="warn">{t('deviceCheck.storage.failHint')}</Hint>}
      <button className={`btn btn-block ${status === 'pending' ? 'btn-primary' : ''}`} onClick={run} disabled={busy}>
        {status === 'pending' ? t('deviceCheck.storage.run') : t('deviceCheck.redo')}
      </button>
    </CheckCard>
  )
}

// ---------- Return from background ----------

type BackgroundRecord = BackgroundCheck & { pageId?: string }

function BackgroundCard({ report, save }: CardProps) {
  const c = report?.background as BackgroundRecord | undefined
  // Running = started in this page load and not back yet; derived from the
  // stored record so a test survives leaving and reopening this screen.
  const running = !!c && c.returnedAt === undefined && c.pageId === PAGE_ID
  /** Time the page was hidden, kept in memory: the write may not finish before iOS suspends. */
  const hiddenRef = useRef<number | undefined>(undefined)
  const [asking, setAsking] = useState(false)
  const checkedLoad = useRef(false)
  const now = useNow(250, running)

  // A test left open by an earlier page load means iOS reloaded the app while
  // it was in the background: record the return from what was saved.
  useEffect(() => {
    if (checkedLoad.current || report === undefined) return
    checkedLoad.current = true
    if (!c || c.returnedAt !== undefined || c.pageId === PAGE_ID) return
    const at = Date.now()
    void save((r) => ({
      ...r,
      background: { ...(r.background as BackgroundCheck), returnedAt: at, reloaded: true, audioStateOnReturn: audioState() ?? 'none', remainingOnReturnMs: backgroundRemainingMs(r.background as BackgroundCheck, at), at },
    }))
  }, [report, c, save])

  const storedHiddenAt = c?.hiddenAt
  useEffect(() => {
    if (!running) return
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (hiddenRef.current === undefined) {
          const hiddenAt = Date.now()
          hiddenRef.current = hiddenAt
          // Best effort: iOS may suspend the page before this write ends.
          void save((r) => ({ ...r, background: { ...(r.background as BackgroundCheck), hiddenAt } }))
        }
        return
      }
      const hiddenAt = hiddenRef.current ?? storedHiddenAt
      if (hiddenAt === undefined) return
      const at = Date.now()
      void save((r) => ({
        ...r,
        background: {
          ...(r.background as BackgroundCheck),
          hiddenAt,
          returnedAt: at,
          reloaded: false,
          audioStateOnReturn: audioState() ?? 'none',
          remainingOnReturnMs: backgroundRemainingMs(r.background as BackgroundCheck, at),
          at,
        },
      }))
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [running, storedHiddenAt, save])

  async function start() {
    const at = Date.now()
    hiddenRef.current = undefined
    setAsking(false)
    const record: BackgroundRecord = { startedAt: at, durationMs: BACKGROUND_MS, pageId: PAGE_ID, at }
    await save((r) => ({ ...r, background: record }))
  }

  const play = () => {
    unlockAudio()
    playRestEndSound()
    setAsking(true)
  }
  const answer = (heard: boolean) => {
    setAsking(false)
    void save((r) => ({ ...r, background: { ...(r.background as BackgroundCheck), heardAfterReturn: heard } }))
  }

  const returned = c?.returnedAt !== undefined
  const away = c ? backgroundAway(c) : null
  const tooShort = returned && away !== null && away < MIN_BACKGROUND_MS && !c?.reloaded
  const status = report ? checkStatus(report, 'background') : 'pending'
  const remaining = c && running ? backgroundRemainingMs(c, now) : 0

  return (
    <CheckCard id="background" report={report} howTo={t('deviceCheck.background.howTo')}>
      {running && (
        <>
          <div className="num" style={{ fontSize: 40, fontWeight: 650, textAlign: 'center' }} data-testid="background-countdown">
            {remaining > 0 ? formatClock(remaining) : `+${formatClock(-remaining)}`}
          </div>
          <span className="small">{t('deviceCheck.background.running', { time: remaining > 0 ? formatClock(remaining) : `+${formatClock(-remaining)}` })}</span>
        </>
      )}
      {!running && tooShort && <Hint kind="warn">{t('deviceCheck.background.tooShort')}</Hint>}
      {!running && returned && !tooShort && c?.heardAfterReturn === undefined && (
        <>
          {asking ? (
            <YesNo onAnswer={answer} />
          ) : (
            <>
              <span className="small">{t('deviceCheck.background.playStep')}</span>
              <button className="btn btn-primary btn-block" onClick={play}>
                {t('deviceCheck.background.play')}
              </button>
            </>
          )}
        </>
      )}
      {!running && c?.heardAfterReturn === false && <Hint kind="warn">{t('deviceCheck.background.noSoundHint')}</Hint>}
      {!running && (
        <button className={`btn btn-block ${status === 'pending' && !returned ? 'btn-primary' : 'btn-ghost'}`} onClick={start}>
          {status === 'pending' && !returned ? t('deviceCheck.background.start') : t('deviceCheck.redo')}
        </button>
      )}
    </CheckCard>
  )
}
