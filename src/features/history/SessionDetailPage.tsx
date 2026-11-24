import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { ConfirmSheet } from '../../components/Sheet'
import { db } from '../../data/db'
import { summarize } from '../../domain/session'
import { formatClock, formatDate, formatDuration, formatInt, formatNumber, formatTime, t } from '../../i18n'
import { useSafe } from '../shared'

export function SessionDetailPage() {
  const { id = '' } = useParams()
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  const navigate = useNavigate()
  const safe = useSafe()
  const [confirm, setConfirm] = useState(false)
  if (session === undefined) return null
  if (!session) return <div className="page"><PageHeader title={t('errors.notFound')} back="/historico" /></div>
  const sum = summarize(session, session.endedAt ?? session.startedAt)

  return (
    <div className="page">
      <PageHeader
        title={session.templateName}
        eyebrow={`${formatDate(session.startedAt)} · ${formatTime(session.startedAt)}`}
        back={true}
        actions={
          <button className="btn btn-ghost btn-icon" aria-label={t('history.deleteSession')} onClick={() => setConfirm(true)}>
            <Trash2 size={20} />
          </button>
        }
      />
      <div className="grid-2">
        <div className="card tight"><div className="stat"><span className="stat-value">{formatDuration(sum.durationMs)}</span><span className="stat-label">{t('workout.summaryDuration')}</span></div></div>
        <div className="card tight"><div className="stat"><span className="stat-value">{sum.workingSets}</span><span className="stat-label">{t('workout.summarySets')}</span></div></div>
        <div className="card tight"><div className="stat"><span className="stat-value">{sum.exercisesDone}</span><span className="stat-label">{t('workout.summaryExercises')}</span></div></div>
        <div className="card tight"><div className="stat"><span className="stat-value">{formatInt(sum.tonnageKg)} kg</span><span className="stat-label">{t('workout.summaryTonnage')}</span></div></div>
      </div>
      {session.exercises.map((e) => {
        const working = e.sets.filter((x) => x.kind === 'working')
        const rests = working.map((x) => x.restBeforeSec).filter((x): x is number => x !== null)
        const avgRest = rests.length ? rests.reduce((a, b) => a + b, 0) / rests.length : null
        return (
          <section key={e.id} className="card">
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <Link to={`/exercicios/${e.exerciseId}`} style={{ fontWeight: 620, textDecoration: 'none' }}>{e.name}</Link>
              {e.status === 'skipped' && <span className="badge warn">{t('history.skipped')}</span>}
            </div>
            {e.substitutedFor && <span className="xs faint">{t('history.substituted', { name: e.substitutedFor.name })}</span>}
            {e.sets.length > 0 && (
              <div className="stack" style={{ gap: 4 }}>
                {e.sets.map((x, i) => (
                  <div key={x.id} className="row between small num">
                    <span className={x.kind === 'warmup' ? 'faint' : ''}>
                      {x.kind === 'warmup' ? t('workout.warmupShort') : t('workout.working', { n: e.sets.slice(0, i + 1).filter((y) => y.kind === 'working').length })}
                    </span>
                    <span>
                      {formatNumber(x.weightKg)} kg × {x.reps}
                      {x.rir !== null && <span className="faint"> · RIR {x.rir}</span>}
                      {x.formIssue && <span className="badge warn" style={{ marginLeft: 6 }}>{t('workout.formIssue')}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {avgRest !== null && <span className="xs faint">{t('history.restAvg', { time: formatClock(avgRest * 1000) })}</span>}
            {e.notes && <p className="small muted">{e.notes}</p>}
          </section>
        )
      })}
      <ConfirmSheet
        open={confirm}
        title={t('history.deleteSession')}
        body={t('history.deleteSessionConfirm')}
        confirmLabel={t('common.delete')}
        danger
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          safe(async () => {
            await db.sessions.delete(session.id)
            navigate('/historico', { replace: true })
          })
        }
      />
    </div>
  )
}
