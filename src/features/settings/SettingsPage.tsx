import { ChevronDown, Download, FileDown, FileUp, HardDrive, RotateCcw, Share, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useCompletedSessions, useLastBackupAt, useNow, useSettings } from '../../app/hooks'
import { PageHeader } from '../../components/PageHeader'
import { ConfirmSheet } from '../../components/Sheet'
import { Stepper, Switch } from '../../components/Stepper'
import { useToast } from '../../components/Toast'
import { restoreBackup, validateBackup, type BackupFile } from '../../data/backup'
import { backupStatus } from '../../domain/backup'
import { updateSettings } from '../../data/repo'
import { applyProgram, exportProgram, programFileName, validateProgram, type ProgramFile } from '../../data/program'
import { FRFB_V1 } from '../../data/seed/frfb-v1'
import { db } from '../../data/db'
import { useProgram } from '../../app/hooks'
import { MUSCLE_GROUPS, REST_PROFILES, type MuscleGroup, type Settings } from '../../domain/types'
import { WEEK_ORDER } from '../../domain/week'
import { downloadText } from '../../lib/download'
import { formatDate, formatRest, muscleLabel, restProfileLabel, t, weekdayShort, type MessageKey } from '../../i18n'
import { useExportBackup, useSafe } from '../shared'

declare const __APP_VERSION__: string

export function SettingsPage() {
  const settings = useSettings()
  const safe = useSafe()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ backup: BackupFile; counts: Record<string, number> } | null>(null)
  const [advanced, setAdvanced] = useState(false)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const programFileRef = useRef<HTMLInputElement>(null)
  const [pendingProgram, setPendingProgram] = useState<ProgramFile | null>(null)
  const current = useProgram()
  const exportBackup = useExportBackup()
  const lastBackupAt = useLastBackupAt()
  const sessions = useCompletedSessions()
  const now = useNow(60_000)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null))
  }, [])

  if (!settings) return null
  const save = (patch: Partial<Omit<Settings, 'id'>>) => safe(() => updateSettings(patch))

  const toggleDay = (d: number) => {
    const days = settings.trainingDays.includes(d) ? settings.trainingDays.filter((x) => x !== d) : [...settings.trainingDays, d]
    void save({ trainingDays: days.sort() })
  }
  const togglePriority = (tier: 'primary' | 'secondary', m: MuscleGroup) => {
    const other = tier === 'primary' ? 'secondary' : 'primary'
    const list = settings.priorities[tier]
    const next = list.includes(m) ? list.filter((x) => x !== m) : [...list, m]
    void save({ priorities: { ...settings.priorities, [tier]: next, [other]: settings.priorities[other].filter((x) => x !== m) } })
  }

  async function exportCurrentProgram() {
    await safe(async () => {
      const file = await exportProgram()
      downloadText(programFileName(file.name), JSON.stringify(file, null, 2))
      toast.show(t('settings.programExported'))
    })
  }

  async function onProgramFile(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    if (programFileRef.current) programFileRef.current.value = ''
    const ids = new Set(await db.exercises.toCollection().primaryKeys())
    const result = validateProgram(text, ids)
    if (!result.ok) {
      const key = `errors.program${result.error[0].toUpperCase()}${result.error.slice(1)}` as MessageKey
      toast.show(t(key, { detail: result.detail ?? '' }), { kind: 'error' })
      return
    }
    setPendingProgram(result.program)
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    const result = validateBackup(text)
    if (fileRef.current) fileRef.current.value = ''
    if (!result.ok) {
      const key = `errors.backup${result.error[0].toUpperCase()}${result.error.slice(1)}` as MessageKey
      toast.show(t(key, { detail: result.detail ?? '' }), { kind: 'error' })
      return
    }
    setPending({ backup: result.backup, counts: result.counts })
  }

  return (
    <div className="page">
      <PageHeader title={t('settings.title')} />

      <Group title={t('settings.training')}>
        <div className="field">
          <span className="field-label">{t('settings.trainingDays')}</span>
          <div className="chips wrap">
            {WEEK_ORDER.map((d) => (
              <button key={d} className="chip" aria-pressed={settings.trainingDays.includes(d)} onClick={() => toggleDay(d)}>
                {weekdayShort(d)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">{t('settings.targetDuration')}</span>
          <Stepper label={t('settings.targetDuration')} value={settings.targetDurationMin} step={5} min={20} max={150} unit="min" onChange={(v) => save({ targetDurationMin: v })} />
        </div>
      </Group>

      <Group title={t('settings.priorities')}>
        {(['primary', 'secondary'] as const).map((tier) => (
          <div key={tier} className="field">
            <span className="field-label">{t(`settings.${tier}`)}</span>
            <div className="chips wrap">
              {MUSCLE_GROUPS.map((m) => (
                <button key={m} className="chip" aria-pressed={settings.priorities[tier].includes(m)} onClick={() => togglePriority(tier, m)}>
                  {muscleLabel(m)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Group>

      <Group title={t('settings.timerSection')}>
        <span className="field-label">{t('settings.restProfiles')}</span>
        {REST_PROFILES.map((r) => (
          <div key={r} className="row between">
            <span className="small grow">{restProfileLabel(r)}</span>
            <div style={{ width: 170 }}>
              <Stepper
                label={restProfileLabel(r)}
                value={settings.restProfiles[r]}
                step={15}
                min={30}
                max={600}
                format={formatRest}
                onChange={(v) => save({ restProfiles: { ...settings.restProfiles, [r]: v } })}
              />
            </div>
          </div>
        ))}
        <div className="row between">
          <span className="small grow">{t('settings.minRest')}</span>
          <div style={{ width: 170 }}>
            <Stepper label={t('settings.minRest')} value={settings.minRestSec} step={15} min={0} max={300} format={formatRest} onChange={(v) => save({ minRestSec: v })} />
          </div>
        </div>
        <Toggle label={t('settings.sound')} checked={settings.soundEnabled} onChange={(v) => save({ soundEnabled: v })} />
        <Toggle label={t('settings.haptics')} note={t('settings.hapticsNote')} checked={settings.hapticsEnabled} onChange={(v) => save({ hapticsEnabled: v })} />
        <Toggle label={t('settings.keepScreenOn')} note={t('settings.keepScreenOnNote')} checked={settings.keepScreenOn} onChange={(v) => save({ keepScreenOn: v })} />
        <Toggle label={t('settings.warmupTimer')} checked={settings.warmupStartsTimer} onChange={(v) => save({ warmupStartsTimer: v })} />
      </Group>

      <Group title={t('settings.progression')}>
        <div className="field">
          <span className="field-label">{t('settings.rirTolerance')}</span>
          <div className="segmented">
            {[0, 1, 2].map((v) => (
              <button key={v} aria-pressed={settings.rirTolerance === v} onClick={() => save({ rirTolerance: v })}>
                {v}
              </button>
            ))}
          </div>
          <span className="field-note">{t('settings.rirToleranceNote')}</span>
        </div>
      </Group>

      <section className="section">
        <button className="section-title" style={{ background: 'none', border: 0, padding: 0 }} onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>
          <span>{t('settings.advanced')}</span>
          <ChevronDown size={16} style={{ transform: advanced ? 'rotate(180deg)' : undefined }} />
        </button>
        {advanced && (
          <div className="card">
            <span className="small muted">{t('settings.durationModelNote')}</span>
            {(
              [
                ['setSecCompound', 5, 10, 180, 's'],
                ['setSecIsolation', 5, 10, 180, 's'],
                ['loggingSec', 5, 0, 120, 's'],
                ['transitionSec', 15, 0, 600, 's'],
                ['warmupRestSec', 15, 0, 300, 's'],
                ['generalWarmupMin', 1, 0, 30, 'min'],
              ] as const
            ).map(([key, step, min, max, unit]) => (
              <div key={key} className="row between">
                <span className="small grow">{t(`settings.${key}`)}</span>
                <div style={{ width: 170 }}>
                  <Stepper
                    label={t(`settings.${key}`)}
                    value={settings.durationModel[key]}
                    step={step}
                    min={min}
                    max={max}
                    unit={unit}
                    onChange={(v) => save({ durationModel: { ...settings.durationModel, [key]: v } })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Group title={t('settings.program')}>
        {current?.program && <span className="small muted">{t('settings.programCurrent', { name: current.program.name })}</span>}
        <button className="btn btn-block" onClick={exportCurrentProgram}>
          <FileDown size={18} /> {t('settings.exportProgram')}
        </button>
        <span className="field-note">{t('settings.exportProgramNote')}</span>
        <button className="btn btn-block" onClick={() => programFileRef.current?.click()}>
          <FileUp size={18} /> {t('settings.importProgram')}
        </button>
        <input ref={programFileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onProgramFile(e.target.files?.[0])} />
        <button className="btn btn-ghost btn-block" onClick={() => setPendingProgram(FRFB_V1)}>
          <RotateCcw size={18} /> {t('settings.loadBundled')}
        </button>
      </Group>

      <Group title={t('settings.data')}>
        <button className="btn btn-block" onClick={exportBackup}>
          <Download size={18} /> {t('settings.exportBackup')}
        </button>
        <span className="field-note">{t('settings.exportBackupNote')}</span>
        {lastBackupAt !== undefined && sessions && <LastBackup lastBackupAt={lastBackupAt} sessionEndTimes={sessions.map((s) => s.endedAt ?? s.startedAt)} now={now} />}
        <button className="btn btn-block" onClick={() => fileRef.current?.click()}>
          <Upload size={18} /> {t('settings.restoreBackup')}
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="notice">
          <HardDrive size={16} />
          <span>
            <strong style={{ display: 'block', color: 'var(--text)' }}>{t('settings.storage')}</strong>
            {persisted === true ? t('settings.storagePersisted') : persisted === false ? t('settings.storageNotPersisted') : t('settings.storageUnknown')}
          </span>
        </div>
      </Group>

      <Group title={t('settings.about')}>
        <div className="notice">
          <Share size={16} />
          <span>
            <strong style={{ display: 'block', color: 'var(--text)' }}>{t('settings.install')}</strong>
            {t('settings.installSteps')}
          </span>
        </div>
        <span className="small faint">FRAME · {t('settings.version', { v: __APP_VERSION__ })}</span>
      </Group>

      <ConfirmSheet
        open={pendingProgram !== null}
        title={t('settings.importProgram')}
        body={pendingProgram ? t('settings.importConfirm', { name: pendingProgram.name, n: pendingProgram.workouts.length }) : ''}
        confirmLabel={t('settings.importProgram')}
        onClose={() => setPendingProgram(null)}
        onConfirm={() =>
          pendingProgram &&
          safe(async () => {
            await applyProgram(pendingProgram)
            toast.show(t('settings.importDone', { name: pendingProgram.name }))
          })
        }
      />
      <ConfirmSheet
        open={pending !== null}
        title={t('settings.restoreBackup')}
        body={pending ? t('settings.restoreConfirm', { sessions: pending.counts.sessions, templates: pending.counts.templates, exercises: pending.counts.exercises }) : ''}
        confirmLabel={t('settings.restoreBackup')}
        danger
        onClose={() => setPending(null)}
        onConfirm={() =>
          pending &&
          safe(async () => {
            await restoreBackup(pending.backup)
            toast.show(t('settings.restoreDone'))
          })
        }
      />
    </div>
  )
}

function LastBackup({ lastBackupAt, sessionEndTimes, now }: { lastBackupAt: number | null; sessionEndTimes: number[]; now: number }) {
  const st = backupStatus(lastBackupAt, sessionEndTimes, now)
  if (st.lastBackupAt === null) return <span className={`small ${st.stale ? 'warn-text' : 'muted'}`}>{t('settings.lastBackupNever')}</span>
  const date = formatDate(st.lastBackupAt)
  const when =
    st.daysSince === 0
      ? t('settings.lastBackupToday', { date })
      : st.daysSince === 1
        ? t('settings.lastBackupYesterday', { date })
        : t('settings.lastBackupDays', { date, days: st.daysSince ?? 0 })
  const unsaved =
    st.unsavedSessions === 0 ? '' : st.unsavedSessions === 1 ? t('settings.lastBackupUnsavedOne') : t('settings.lastBackupUnsaved', { n: st.unsavedSessions })
  return <span className={`small ${st.stale ? 'warn-text' : 'muted'}`}>{unsaved ? `${when} ${unsaved}` : when}</span>
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-title">{title}</div>
      <div className="card">{children}</div>
    </section>
  )
}

function Toggle({ label, note, checked, onChange }: { label: string; note?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="switch-row">
      <span className="stack" style={{ gap: 2 }}>
        <span>{label}</span>
        {note && <span className="xs faint">{note}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}
