import { useLiveQuery } from 'dexie-react-hooks'
import { Trophy } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useExerciseMap, useSettings } from '../../app/hooks'
import { BrandMark } from '../../components/BrandMark'
import { db } from '../../data/db'
import { exerciseHistory } from '../../data/repo'
import { estimateSession } from '../../domain/duration'
import { sessionRecords } from '../../domain/records'
import { summarize } from '../../domain/session'
import type { SetLog } from '../../domain/types'
import { formatDuration, formatInt, formatKg, t } from '../../i18n'

export function WorkoutSummaryPage() {
  const { id = '' } = useParams()
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  const settings = useSettings()
  const exMap = useExerciseMap()
  const template = useLiveQuery(async () => (session?.templateId ? ((await db.templates.get(session.templateId)) ?? null) : null), [session?.templateId])
  const records = useLiveQuery(async () => {
    if (!session) return []
    const previous = new Map<string, Array<{ date: number; working: SetLog[] }>>()
    for (const exId of session.exerciseIds) {
      const history = await exerciseHistory(exId)
      previous.set(exId, history.filter((h) => h.sessionId !== session.id && h.date < session.startedAt))
    }
    return sessionRecords(session, previous)
  }, [session?.id, session?.updatedAt])

  if (session === undefined) return null
  if (!session) {
    return (
      <div className="workout">
        <div className="empty">{t('errors.notFound')}</div>
      </div>
    )
  }
  const s = summarize(session, session.endedAt ?? session.updatedAt)
  const estimateSec = template && exMap && settings ? estimateSession(template.exercises, (x) => exMap.get(x), settings).totalSec : 0

  return (
    <div className="workout" style={{ paddingBottom: 'calc(32px + var(--safe-bottom))' }}>
      <div className="summary-hero" style={{ paddingTop: 'calc(var(--safe-top) + 48px)' }}>
        <BrandMark size={44} />
        <h1 className="wk-name">{t('workout.finishedTitle')}</h1>
        <p className="muted">{t('workout.finishedBody')}</p>
        <p className="small faint">{session.templateName}</p>
      </div>
      <div className="grid-2">
        <Stat label={t('workout.summaryDuration')} value={formatDuration(s.durationMs)} />
        <Stat label={t('workout.summarySets')} value={String(s.workingSets)} />
        <Stat label={t('workout.summaryExercises')} value={String(s.exercisesDone)} />
        <Stat label={t('workout.summaryTonnage')} value={`${formatInt(s.tonnageKg)} kg`} />
      </div>
      <div className="stack" style={{ marginTop: 'var(--s-3)', gap: 4 }}>
        {estimateSec > 0 && <p className="small muted">{t('workout.summaryEstimate', { time: formatDuration(estimateSec * 1000) })}</p>}
        {s.exercisesSkipped > 0 && (
          <p className="small muted">{s.exercisesSkipped === 1 ? t('workout.summarySkippedOne') : t('workout.summarySkipped', { n: s.exercisesSkipped })}</p>
        )}
        <p className="xs faint">{t('workout.summaryTonnageHelp')}</p>
      </div>

      {records && records.length > 0 && (
        <section className="section" style={{ marginTop: 'var(--s-5)' }}>
          <div className="section-title">{t('workout.summaryRecords')}</div>
          <div className="list">
            {records.map((r) => (
              <div key={r.exerciseId} className="list-row">
                <Trophy size={18} color="var(--accent)" />
                <span className="grow">
                  <span className="title" style={{ display: 'block' }}>{r.name}</span>
                  <span className="sub num">{t('workout.summaryBefore', { value: `${formatKg(r.previous.weightKg)} × ${r.previous.reps}` })}</span>
                </span>
                <span className="num" style={{ fontWeight: 650 }}>{`${formatKg(r.weightKg)} × ${r.reps}`}</span>
              </div>
            ))}
          </div>
          <p className="xs faint">{t('workout.summaryRecordsNote')}</p>
        </section>
      )}

      <div className="stack" style={{ marginTop: 'var(--s-6)' }}>
        <Link to="/" replace className="btn btn-primary btn-lg btn-block">
          {t('workout.goHome')}
        </Link>
        <Link to={`/historico/${session.id}`} replace className="btn btn-block">
          {t('history.detail')}
        </Link>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card tight">
      <div className="stat">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  )
}
