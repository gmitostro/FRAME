import { BarChart3, Check, ChevronRight, Clock, Download, Dumbbell, Layers, Moon, Play, ShieldAlert, TriangleAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useActiveSession, useCompletedSessions, useExerciseMap, useLastBackupAt, useNow, useProgram, useSettings } from '../../app/hooks'
import { Brand } from '../../components/BrandMark'
import { backupStatus } from '../../domain/backup'
import { sessionElapsedMs, summarize } from '../../domain/session'
import { daysUntil, sameDay, startOfWeek, WEEK_ORDER, dateOfWeekday } from '../../domain/week'
import type { Exercise, Settings, WorkoutTemplate } from '../../domain/types'
import {
  formatDate,
  formatDuration,
  formatShortDate,
  muscleLabel,
  t,
  weekdayInitial,
  weekdayLong,
  weekdayOnDay,
} from '../../i18n'
import { exercisesLabel, templateEstimate, templateMuscles, templateSetCount, useExportBackup, useStartWorkout } from '../shared'

export function HomePage() {
  const program = useProgram()
  const settings = useSettings()
  const exMap = useExerciseMap()
  const active = useActiveSession()
  const sessions = useCompletedSessions()
  const now = useNow(30_000)
  const start = useStartWorkout()
  const navigate = useNavigate()
  const lastBackupAt = useLastBackupAt()
  const exportBackup = useExportBackup()

  if (!program || !settings || !exMap || active === undefined || !sessions || lastBackupAt === undefined) return null

  const today = new Date(now).getDay()
  const templates = program.templates
  const todayTpl = templates.find((x) => x.weekday === today)
  const scheduled = templates.filter((x) => x.weekday !== null) as Array<WorkoutTemplate & { weekday: number }>
  const next = todayTpl
    ? null
    : [...scheduled].sort((a, b) => daysUntil(today, a.weekday) - daysUntil(today, b.weekday)).find((x) => daysUntil(today, x.weekday) > 0)

  const weekStart = startOfWeek(now)
  const weekSessions = sessions.filter((s) => s.startedAt >= weekStart)
  const trainedToday = sessions.some((s) => sameDay(s.startedAt, now))
  const plannedCount = scheduled.length || settings.trainingDays.length
  const weekSets = weekSessions.reduce((n, s) => n + summarize(s, now).workingSets, 0)
  const last = sessions[0]
  const backup = backupStatus(lastBackupAt, sessions.map((s) => s.endedAt ?? s.startedAt), now)

  return (
    <div className="page">
      <header className="row between" style={{ minHeight: 44 }}>
        <Brand />
        <span className="small faint">{formatDate(now)}</span>
      </header>

      <div>
        <p className="faint small" style={{ fontWeight: 600 }}>{weekdayLong(today)}</p>
      </div>

      {active && (
        <Link to="/treino" className="card framed accent card-link" aria-label={t('home.resumeWorkout')}>
          <div className="row between">
            <span className="badge accent">
              <span className="pulse" style={{ width: 6, height: 6 }} /> {t('home.workoutInProgress')}
            </span>
            <span className="small muted num">{formatDuration(sessionElapsedMs(active, now))}</span>
          </div>
          <div className="card-title">{active.templateName}</div>
          {now - active.startedAt > 12 * 3_600_000 && (
            <div className="notice warn">
              <TriangleAlert size={16} />
              <span>{t('home.staleSession')}</span>
            </div>
          )}
          <span className="btn btn-primary btn-lg btn-block">
            <Play size={20} /> {t('home.resumeWorkout')}
          </span>
        </Link>
      )}

      {!active && todayTpl && (
        <TodayCard tpl={todayTpl} exMap={exMap} settings={settings} trainedToday={trainedToday} onStart={() => start(todayTpl.id)} onBuild={() => navigate(`/treinos/${todayTpl.id}`)} />
      )}

      {!active && !todayTpl && (
        <section className="card">
          <div className="row">
            <Moon size={20} className="faint" />
            <span className="card-title">{t('home.restDay')}</span>
          </div>
          <p className="muted small">{t('home.restDayBody')}</p>
          {next && <p className="small">{t('home.nextWorkout', { name: next.name, day: weekdayOnDay(next.weekday) })}</p>}
        </section>
      )}

      {!active && backup.stale && (
        <section className="card backup-reminder" aria-label={t('settings.exportBackup')}>
          <div className="notice warn">
            <ShieldAlert size={16} />
            <span>
              {backup.daysSince === null
                ? t('home.backupNever')
                : t('home.backupOld', {
                    days: backup.daysSince,
                    unsaved: backup.unsavedSessions === 1 ? t('home.backupUnsavedOne') : t('home.backupUnsaved', { n: backup.unsavedSessions }),
                  })}
            </span>
          </div>
          <button className="btn btn-block" onClick={() => void exportBackup()}>
            <Download size={18} /> {t('home.backupNow')}
          </button>
        </section>
      )}

      <section className="section">
        <div className="section-title">
          <span>{t('home.thisWeek')}</span>
          <span className="num" style={{ letterSpacing: 0 }}>
            {t('home.weekProgress', { done: weekSessions.length, planned: plannedCount })}
          </span>
        </div>
        <div className="week" aria-label={t('home.thisWeek')}>
          {WEEK_ORDER.map((d) => {
            const date = dateOfWeekday(weekStart, d)
            const done = weekSessions.some((s) => sameDay(s.startedAt, date))
            const planned = scheduled.some((x) => x.weekday === d)
            const isToday = d === today
            const cls = ['day', done ? 'done' : '', planned ? 'planned' : '', isToday ? 'today' : ''].join(' ')
            return (
              <div key={d} className={cls} title={weekdayLong(d)}>
                <span className="d">{weekdayInitial(d)}</span>
                <span className="dot" />
              </div>
            )
          })}
        </div>
        <div className="grid-2">
          <div className="card tight">
            <div className="stat">
              <span className="stat-value">{weekSessions.length}</span>
              <span className="stat-label">{t('nav.program')}</span>
            </div>
          </div>
          <div className="card tight">
            <div className="stat">
              <span className="stat-value">{weekSets}</span>
              <span className="stat-label">{t('home.workingSetsWeek')}</span>
            </div>
          </div>
        </div>
        <div className="list">
          <Link to="/volume" className="list-row">
            <BarChart3 size={20} className="faint" />
            <span className="grow">
              <span className="title" style={{ display: 'block' }}>{t('volume.link')}</span>
              <span className="sub">{t('volume.linkSub')}</span>
            </span>
            <ChevronRight size={18} className="faint" />
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="section-title">{t('home.lastWorkout')}</div>
        {last ? (
          <Link to={`/historico/${last.id}`} className="list-row list card-link" style={{ borderRadius: 'var(--r-lg)' }}>
            <span className="grow">
              <span className="title" style={{ display: 'block' }}>{last.templateName}</span>
              <span className="sub">
                {formatShortDate(last.startedAt)} · {formatDuration(summarize(last, now).durationMs)} · {t('home.setsCount', { n: summarize(last, now).workingSets })}
              </span>
            </span>
            <ChevronRight size={18} className="faint" />
          </Link>
        ) : (
          <p className="muted small">{t('home.noWorkoutsYet')}</p>
        )}
      </section>

      {!active && (
        <Link to="/treinos" className="btn btn-ghost btn-block">
          {t('home.otherWorkout')}
        </Link>
      )}
    </div>
  )
}

interface TodayCardProps {
tpl: WorkoutTemplate
trainedToday: boolean
onStart: () => void
onBuild: () => void
exMap: Map<string, Exercise>
settings: Settings
}

function TodayCard({ tpl, trainedToday, onStart, onBuild, exMap, settings }: TodayCardProps) {
  const est = templateEstimate(tpl, exMap, settings)
  const muscles = templateMuscles(tpl, exMap)
  const empty = tpl.exercises.length === 0
  return (
    <section className="card framed">
      <span className="eyebrow faint xs" style={{ letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 650 }}>
        {t('home.todayWorkout')}
      </span>
      <div className="card-title" style={{ fontSize: 'var(--fs-2xl)' }}>{tpl.name}</div>
      {!empty && (
        <div className="meta">
          <span><Dumbbell size={15} /> {exercisesLabel(tpl.exercises.length)}</span>
          <span><Layers size={15} /> {t('home.setsCount', { n: templateSetCount(tpl) })}</span>
          <span><Clock size={15} /> {t('home.estimated', { time: formatDuration(est.totalSec * 1000) })}</span>
        </div>
      )}
      {muscles.length > 0 && (
        <div className="chips wrap">
          {muscles.slice(0, 6).map((m) => (
            <span key={m} className="badge">{muscleLabel(m)}</span>
          ))}
        </div>
      )}
      {trainedToday && (
        <div className="notice accent">
          <Check size={16} />
          <span>{t('home.trainedToday')}</span>
        </div>
      )}
      {empty ? (
        <>
          <p className="muted small">{t('home.emptyWorkout')}</p>
          <button className="btn btn-block btn-lg" onClick={onBuild}>{t('home.buildWorkout')}</button>
        </>
      ) : (
        <button className="btn btn-primary btn-lg btn-block" onClick={onStart}>
          <Play size={20} /> {t('home.startWorkout')}
        </button>
      )}
    </section>
  )
}
