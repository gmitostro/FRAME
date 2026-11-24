import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  SkipForward,
  StickyNote,
  TrendingUp,
  Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useActiveSession, useExerciseMap, useNow, useSettings } from '../../app/hooks'
import { ConfirmSheet, Sheet } from '../../components/Sheet'
import { useToast } from '../../components/Toast'
import { lastPerformance, mutateSession } from '../../data/repo'
import { suggestProgression, type ProgressionSuggestion } from '../../domain/progression'
import * as S from '../../domain/session'
import type { Exercise, SessionExercise, SetKind, SetLog, Settings, WorkoutSession } from '../../domain/types'
import { acquireWakeLock, releaseWakeLock, unlockAudio } from '../../lib/feedback'
import { newId } from '../../lib/id'
import { formatClock, formatKg, formatNumber, formatPct, formatRest, formatShortDate, t } from '../../i18n'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { loggerDefaults, nextKind } from './prefill'
import { RestTimerDock } from './RestTimerDock'
import { SetEditSheet } from './SetEditSheet'
import { SetLogger } from './SetLogger'

type SheetName = null | 'menu' | 'overview' | 'finish' | 'discard' | 'substitute' | 'add' | 'notes'

export function ActiveWorkoutPage() {
  const session = useActiveSession()
  const settings = useSettings()
  const exMap = useExerciseMap()
  const navigate = useNavigate()

  if (session === undefined || !settings || !exMap) return null
  if (session === null) {
    return (
      <div className="workout">
        <div className="empty" style={{ marginTop: '25vh' }}>
          <p>{t('workout.noActive')}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            {t('workout.goHome')}
          </button>
        </div>
      </div>
    )
  }
  return <LiveWorkout session={session} settings={settings} exMap={exMap} />
}

function LiveWorkout({ session, settings, exMap }: { session: WorkoutSession; settings: Settings; exMap: Map<string, Exercise> }) {
  const navigate = useNavigate()
  const toast = useToast()
  const now = useNow(1000)
  const [sheet, setSheet] = useState<SheetName>(null)
  const [editing, setEditing] = useState<SetLog | null>(null)
  const [override, setOverride] = useState<{ exId: string; kind: SetKind } | null>(null)

  const index = Math.min(session.currentIndex, Math.max(0, session.exercises.length - 1))
  const current: SessionExercise | undefined = session.exercises[index]
  const exercise = current ? exMap.get(current.exerciseId) : undefined
  const stepKg = exercise?.loadStepKg ?? 2.5

  const last = useLiveQuery(async () => (current ? lastPerformance(current.exerciseId) : null), [current?.exerciseId])

  const mutate = useCallback(
    async (fn: (s: WorkoutSession, now: number) => WorkoutSession) => {
      try {
        return await mutateSession(session.id, fn)
      } catch (err) {
        console.error(err)
        toast.show(t('errors.saveFailed'), { kind: 'error' })
        return undefined
      }
    },
    [session.id, toast],
  )

  // Keep the screen awake while training, where supported.
  useEffect(() => {
    if (!settings.keepScreenOn) return
    void acquireWakeLock()
    const onVis = () => document.visibilityState === 'visible' && void acquireWakeLock()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void releaseWakeLock()
    }
  }, [settings.keepScreenOn])

  const kindOverride = override && override.exId === current?.id ? override.kind : null
  const setKindOverride = (kind: SetKind | null) => setOverride(kind && current ? { exId: current.id, kind } : null)

  // Cheap pure computation; no memoization needed.
  const suggestion: ProgressionSuggestion | null =
    !current || !exercise || last === undefined
      ? null
      : suggestProgression({
          prescription: current.prescription,
          lastWorkingSets: last?.working ?? [],
          exercise,
          rirTolerance: settings.rirTolerance,
        })

  const onTimerAction = useCallback((a: S.TimerAction) => void mutate((s, n) => S.applyTimerAction(s, a, n)), [mutate])

  if (!current) {
    return (
      <div className="workout">
        <TopBar session={session} now={now} onMenu={() => setSheet('menu')} onPause={() => mutate((s, n) => (s.pausedAt ? S.resumeSession(s, n) : S.pauseSession(s, n)))} />
        <div className="empty">
          <p>{t('program.noExercises')}</p>
          <button className="btn btn-primary" onClick={() => setSheet('add')}>
            <Plus size={18} /> {t('workout.addExercise')}
          </button>
        </div>
        {renderSheets()}
      </div>
    )
  }

  const p = current.prescription
  const working = S.workingSets(current)
  const warm = S.warmupSets(current)
  const complete = S.isExerciseComplete(current)
  const kind = kindOverride ?? nextKind(current)
  const defaults = loggerDefaults(current, kind, suggestion, last ?? null, stepKg)
  const nextIdx = S.nextPendingIndex(session, index)
  const nextName = nextIdx !== null ? session.exercises[nextIdx]?.name : null
  const repRange = p.repMin === p.repMax ? `${p.repMin}` : `${p.repMin}–${p.repMax}`
  const loggerLabel = kind === 'warmup' ? `${t('workout.warmup')} ${warm.length + 1}` : t('workout.working', { n: working.length + 1 })
  // Wait for history so pre-filled values are right on first render.
  const showLogger = last !== undefined && current.status !== 'skipped' && (!complete || kindOverride !== null)

  async function logSet(v: { kind: SetKind; weightKg: number; reps: number; rir: number | null }) {
    unlockAudio()
    await mutate((s, n) => S.addSet(s, index, v, n, newId, { warmupStartsTimer: settings.warmupStartsTimer }))
    setKindOverride(null)
  }

  function renderSheets() {
    return (
      <>
        <Sheet open={sheet === 'menu'} title={session.templateName} onClose={() => setSheet(null)}>
          <div className="list">
            <button className="list-row" onClick={() => setSheet('overview')}>
              <ListOrdered size={20} /> <span className="grow">{t('workout.overview')}</span>
            </button>
            <button className="list-row" onClick={() => setSheet('add')}>
              <Plus size={20} /> <span className="grow">{t('workout.addExercise')}</span>
            </button>
          </div>
          <button className="btn btn-primary btn-lg btn-block" onClick={() => setSheet('finish')}>
            <Check size={20} /> {t('workout.finish')}
          </button>
          <button className="btn btn-danger btn-block" onClick={() => setSheet('discard')}>
            {t('workout.discard')}
          </button>
        </Sheet>

        <Sheet open={sheet === 'overview'} title={t('workout.overview')} onClose={() => setSheet(null)}>
          <div className="list">
            {session.exercises.map((e, i) => {
              const w = S.workingSets(e).length
              const cls = e.status === 'done' ? 'done' : e.status === 'skipped' ? 'skipped' : i === index ? 'current' : ''
              return (
                <button
                  key={e.id}
                  className="list-row"
                  onClick={() => {
                    void mutate((s, n) => S.setCurrent(s, i, n))
                    setSheet(null)
                  }}
                >
                  <span className={`ex-status ${cls}`}>{e.status === 'done' ? <Check size={14} /> : i + 1}</span>
                  <span className="grow">
                    <span className="title" style={{ display: 'block' }}>{e.name}</span>
                    <span className="sub num">
                      {e.status === 'skipped' ? t('workout.skipped') : `${w}/${e.prescription.workingSets} ${t('common.sets')}`}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          <button className="btn btn-block" onClick={() => setSheet('add')}>
            <Plus size={18} /> {t('workout.addExercise')}
          </button>
        </Sheet>

        <ConfirmSheet
          open={sheet === 'finish'}
          title={t('workout.finishConfirm')}
          body={(() => {
            const pending = session.exercises.filter((e) => e.status === 'pending' && e.sets.length === 0).length
            return pending > 0 ? t('workout.finishPending', { n: pending }) : undefined
          })()}
          confirmLabel={t('workout.finish')}
          onClose={() => setSheet(null)}
          onConfirm={async () => {
            const done = await mutate((s, n) => S.finishSession(s, n))
            if (done) navigate(`/treino/resumo/${done.id}`, { replace: true })
          }}
        />
        <ConfirmSheet
          open={sheet === 'discard'}
          title={t('workout.discard')}
          body={t('workout.discardConfirm')}
          confirmLabel={t('workout.discard')}
          danger
          onClose={() => setSheet(null)}
          onConfirm={async () => {
            await mutate((s, n) => S.discardSession(s, n))
            navigate('/', { replace: true })
          }}
        />
        <ExercisePicker
          open={sheet === 'substitute'}
          title={current ? t('workout.substituteTitle', { name: current.name }) : undefined}
          note={current && current.sets.length > 0 ? t('workout.substituteWithSets') : undefined}
          suggestFor={exercise}
          onClose={() => setSheet(null)}
          onPick={(ex) => {
            setSheet(null)
            void mutate((s, n) => S.substituteExercise(s, index, ex, n, newId, settings))
          }}
        />
        <ExercisePicker
          open={sheet === 'add'}
          onClose={() => setSheet(null)}
          onPick={(ex) => {
            setSheet(null)
            void mutate((s, n) => S.addExerciseToSession(s, ex, n, newId, settings))
          }}
        />
        {current && (
          <NotesSheet
            open={sheet === 'notes'}
            value={current.notes ?? ''}
            onClose={() => setSheet(null)}
            onSave={(v) => {
              setSheet(null)
              void mutate((s, n) => S.setExerciseNotes(s, index, v, n))
            }}
          />
        )}
        <SetEditSheet
          set={editing}
          stepKg={stepKg}
          onClose={() => setEditing(null)}
          onDelete={() => {
            const id = editing?.id
            setEditing(null)
            if (id) void mutate((s, n) => S.removeSet(s, index, id, n))
          }}
          onSave={(patch) => {
            const id = editing?.id
            setEditing(null)
            if (id) void mutate((s, n) => S.updateSet(s, index, id, patch, n))
          }}
        />
      </>
    )
  }

  return (
    <div className={`workout ${session.restTimer ? 'has-timer' : ''}`}>
      <TopBar session={session} now={now} onMenu={() => setSheet('menu')} onPause={() => mutate((s, n) => (s.pausedAt ? S.resumeSession(s, n) : S.pauseSession(s, n)))} />

      <div className="wk-body">
        {session.pausedAt !== null && (
          <div className="notice accent" role="status">
            <Pause size={16} />
            <span className="grow">
              <strong style={{ display: 'block' }}>{t('workout.paused')}</strong>
              {t('workout.pausedBody')}
            </span>
            <button className="btn btn-sm btn-primary" onClick={() => mutate((s, n) => S.resumeSession(s, n))}>
              {t('workout.resume')}
            </button>
          </div>
        )}

        <div className="stack" style={{ gap: 6 }}>
          <button className="row xs faint" style={{ background: 'none', border: 0, padding: 0, fontWeight: 650, letterSpacing: '0.08em', textTransform: 'uppercase' }} onClick={() => setSheet('overview')}>
            {t('workout.exerciseOf', { i: index + 1, n: session.exercises.length })} <ChevronDown size={14} />
          </button>
          <h1 className="wk-name">{current.name}</h1>
          {current.substitutedFor && <span className="small faint">{t('workout.substituted', { name: current.substitutedFor.name })}</span>}
          <div className="presc">
            <span className="badge">{t('workout.prescription', { sets: p.workingSets, reps: repRange, rir: p.rirTarget })}</span>
            <span className="badge">{t('workout.restShort', { time: formatRest(p.restSec) })}</span>
            {current.status === 'skipped' && <span className="badge warn">{t('workout.skipped')}</span>}
          </div>
        </div>

        <PreviousLine last={last} />
        <SuggestionCard suggestion={suggestion} />
        {current.notes && (
          <button className="notice" style={{ textAlign: 'left' }} onClick={() => setSheet('notes')}>
            <StickyNote size={16} /> <span>{current.notes}</span>
          </button>
        )}

        <div className="pills" aria-label={t('common.sets')}>
          {Array.from({ length: Math.max(p.warmupSets, warm.length) }).map((_, i) => {
            const state = i < warm.length ? 'done' : kind === 'warmup' && i === warm.length && showLogger ? 'current' : ''
            return (
              <span key={`w${i}`} className={`pill warm ${state}`}>
                {t('workout.warmupShort')} {i + 1}
              </span>
            )
          })}
          {Array.from({ length: Math.max(p.workingSets, working.length) }).map((_, i) => {
            const state = i < working.length ? 'done' : kind === 'working' && i === working.length && showLogger ? 'current' : ''
            return (
              <span key={`k${i}`} className={`pill ${state}`}>
                S{i + 1}
              </span>
            )
          })}
        </div>

        {showLogger && (
          <SetLogger
            key={`${current.id}-${current.sets.length}-${kind}`}
            defaults={defaults}
            label={loggerLabel}
            stepKg={stepKg}
            repRange={repRange}
            target={kind === 'working' ? `${repRange} · RIR ${p.rirTarget}` : null}
            onSubmit={logSet}
            onKindChange={setKindOverride}
            autoScroll={current.sets.length > 0}
          />
        )}

        {complete && current.status !== 'skipped' && !kindOverride && (
          <section className="card accent">
            <div className="row">
              <Check size={20} color="var(--accent)" />
              <strong className="grow">{t('workout.exerciseDone')}</strong>
            </div>
            {nextName ? (
              <button className="btn btn-primary btn-lg btn-block" onClick={() => nextIdx !== null && mutate((s, n) => S.setCurrent(s, nextIdx, n))}>
                {t('workout.nextUp', { name: nextName })} <ChevronRight size={20} />
              </button>
            ) : (
              <>
                <p className="small muted">{t('workout.allDone')}</p>
                <button className="btn btn-primary btn-lg btn-block" onClick={() => setSheet('finish')}>
                  <Check size={20} /> {t('workout.finish')}
                </button>
              </>
            )}
          </section>
        )}

        {current.sets.length > 0 && (
          <div className="sets" aria-label={t('workout.editSet')}>
            {current.sets.map((x) => {
              const wi = x.kind === 'working' ? working.indexOf(x) + 1 : warm.indexOf(x) + 1
              return (
                <button key={x.id} className={`set-row done ${x.kind === 'warmup' ? 'warm' : ''}`} onClick={() => setEditing(x)} aria-label={`${t('workout.editSet')} ${wi}`}>
                  <span className="lbl">{x.kind === 'warmup' ? `${t('workout.warmupShort')} ${wi}` : t('workout.working', { n: wi })}</span>
                  <span className="val">
                    {formatNumber(x.weightKg)} kg × {x.reps}
                    {x.kind === 'working' && x.rir !== null && <span className="faint"> · RIR {x.rir}</span>}
                    {x.formIssue && <span className="badge warn" style={{ marginLeft: 6 }}>!</span>}
                  </span>
                  <Check size={18} color="var(--accent)" />
                </button>
              )
            })}
          </div>
        )}

        {current.status === 'skipped' ? (
          <button className="btn btn-block" onClick={() => mutate((s, n) => S.unskipExercise(s, index, n))}>
            <Undo2 size={18} /> {t('workout.unskip')}
          </button>
        ) : (
          <div className="row wrap" style={{ gap: 'var(--s-2)' }}>
            <button className="btn btn-sm grow" onClick={() => setKindOverride('working')}>
              <Plus size={16} /> {t('workout.addSet')}
            </button>
            <button className="btn btn-sm grow" onClick={() => setSheet('substitute')}>
              <ArrowLeftRight size={16} /> {t('workout.substitute')}
            </button>
            <button className="btn btn-sm grow" onClick={() => mutate((s, n) => S.skipExercise(s, index, n))}>
              <SkipForward size={16} /> {t('workout.skip')}
            </button>
            <button className="btn btn-sm btn-icon" onClick={() => setSheet('notes')} aria-label={t('common.notes')}>
              <StickyNote size={16} />
            </button>
          </div>
        )}
      </div>

      {session.restTimer && <RestTimerDock timer={session.restTimer} settings={settings} onAction={onTimerAction} />}

      <footer className="wk-footer">
        <div className="inner">
          <button className="btn" disabled={index === 0} onClick={() => mutate((s, n) => S.setCurrent(s, index - 1, n))}>
            <ChevronLeft size={20} /> {t('workout.previousExercise')}
          </button>
          <button className="btn btn-icon" onClick={() => setSheet('overview')} aria-label={t('workout.overview')}>
            <ListOrdered size={20} />
          </button>
          <button className="btn" disabled={index >= session.exercises.length - 1} onClick={() => mutate((s, n) => S.setCurrent(s, index + 1, n))}>
            {t('workout.nextExercise')} <ChevronRight size={20} />
          </button>
        </div>
      </footer>

      {renderSheets()}
    </div>
  )
}

function TopBar({ session, now, onMenu, onPause }: { session: WorkoutSession; now: number; onMenu: () => void; onPause: () => void }) {
  return (
    <header className="wk-top">
      <Link to="/" className="btn btn-ghost btn-icon" aria-label={t('common.back')}>
        <ChevronDown size={24} />
      </Link>
      <div className="title">
        <strong>{session.templateName}</strong>
        <span>
          {session.pausedAt ? t('workout.paused') : `${t('workout.elapsed')} ${formatClock(S.sessionElapsedMs(session, now))}`}
        </span>
      </div>
      <button className="btn btn-ghost btn-icon" onClick={onPause} aria-label={session.pausedAt ? t('workout.resume') : t('workout.pause')}>
        {session.pausedAt ? <Play size={20} /> : <Pause size={20} />}
      </button>
      <button className="btn btn-ghost btn-icon" onClick={onMenu} aria-label={t('workout.finish')}>
        <MoreHorizontal size={22} />
      </button>
    </header>
  )
}

function PreviousLine({ last }: { last: Awaited<ReturnType<typeof lastPerformance>> | undefined }) {
  if (last === undefined) return null
  if (!last) return <p className="prev-line faint">{t('workout.noHistory')}</p>
  const sets = last.working.map((x) => `${formatNumber(x.weightKg)} × ${x.reps}${x.rir !== null ? ` (RIR ${x.rir})` : ''}`).join(' · ')
  return (
    <p className="prev-line">
      <span className="faint">{t('workout.lastTime', { date: formatShortDate(last.date) })}: </span>
      {sets}
    </p>
  )
}

function SuggestionCard({ suggestion }: { suggestion: ProgressionSuggestion | null }) {
  if (!suggestion || suggestion.kind === 'none') return null
  if (suggestion.kind === 'increase') {
    const delta = `+${formatNumber(suggestion.stepKg)} kg${suggestion.pct !== null ? `, ${formatPct(suggestion.pct)}` : ''}`
    return (
      <div className="suggest up">
        <TrendingUp size={20} color="var(--accent)" style={{ marginTop: 2 }} />
        <div className="stack" style={{ gap: 2 }}>
          <span className="label">{t('workout.suggestion')}</span>
          <span className="value">{t('workout.suggestIncrease', { kg: formatKg(suggestion.toKg), delta })}</span>
          <span className="small muted">{t('workout.suggestIncreaseNote', { reps: suggestion.targetReps })}</span>
          {suggestion.stepAboveRange && <span className="small" style={{ color: 'var(--warn)' }}>{t('workout.suggestStepLarge')}</span>}
        </div>
      </div>
    )
  }
  const note = {
    buildReps: t('workout.holdBuildReps', { reps: suggestion.targetReps }),
    rirBelowTarget: t('workout.holdRir'),
    formIssue: t('workout.holdForm'),
    incompleteSets: t('workout.holdIncomplete'),
    repsBelowMin: t('workout.holdBelowMin'),
  }[suggestion.reason]
  return (
    <div className="suggest">
      <TrendingUp size={20} className="faint" style={{ marginTop: 2 }} />
      <div className="stack" style={{ gap: 2 }}>
        <span className="label">{t('workout.suggestion')}</span>
        <span className="value">{t('workout.suggestHold', { kg: formatKg(suggestion.weightKg) })}</span>
        <span className="small muted">{note}</span>
      </div>
    </div>
  )
}

function NotesSheet(props: { open: boolean; value: string; onClose: () => void; onSave: (v: string) => void }) {
  if (!props.open) return null
  return <NotesBody {...props} />
}

function NotesBody({ open, value, onClose, onSave }: { open: boolean; value: string; onClose: () => void; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  return (
    <Sheet
      open={open}
      title={t('common.notes')}
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={() => onSave(v.trim())}>
          {t('common.save')}
        </button>
      }
    >
      <textarea className="textarea" rows={4} value={v} placeholder={t('workout.notesPlaceholder')} onChange={(e) => setV(e.target.value)} />
    </Sheet>
  )
}
