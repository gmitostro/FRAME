import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { BrandMark } from '../../components/BrandMark'
import { db } from '../../data/db'
import { summarize } from '../../domain/session'
import { formatDuration, formatInt, t } from '../../i18n'

export function WorkoutSummaryPage() {
  const { id = '' } = useParams()
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  if (session === undefined) return null
  if (!session) {
    return (
      <div className="workout">
        <div className="empty">{t('errors.notFound')}</div>
      </div>
    )
  }
  const s = summarize(session, session.endedAt ?? session.updatedAt)
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
      <p className="xs faint" style={{ marginTop: 'var(--s-3)' }}>{t('workout.summaryTonnageHelp')}</p>
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
