import { ChevronRight, History } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCompletedSessions } from '../../app/hooks'
import { PageHeader } from '../../components/PageHeader'
import { summarize } from '../../domain/session'
import { formatDate, formatDuration, formatTime, t, weekdayShort } from '../../i18n'

export function HistoryPage() {
  const sessions = useCompletedSessions()
  if (!sessions) return null
  return (
    <div className="page">
      <PageHeader title={t('history.title')} />
      {sessions.length === 0 ? (
        <div className="empty">
          <History size={36} />
          <p>{t('history.empty')}</p>
        </div>
      ) : (
        <div className="list">
          {sessions.map((s) => {
            const sum = summarize(s, s.endedAt ?? s.startedAt)
            const d = new Date(s.startedAt)
            return (
              <Link key={s.id} to={`/historico/${s.id}`} className="list-row">
                <span className="stack" style={{ gap: 0, minWidth: 52, alignItems: 'center' }}>
                  <span className="xs faint" style={{ fontWeight: 650 }}>{weekdayShort(d.getDay()).toUpperCase()}</span>
                  <span className="num" style={{ fontWeight: 650, fontSize: 'var(--fs-lg)' }}>{String(d.getDate()).padStart(2, '0')}</span>
                </span>
                <span className="grow">
                  <span className="title" style={{ display: 'block' }}>{s.templateName}</span>
                  <span className="sub num">
                    {formatDate(s.startedAt)} {formatTime(s.startedAt)} · {formatDuration(sum.durationMs)} · {t('history.sets', { n: sum.workingSets })}
                  </span>
                </span>
                <ChevronRight size={18} className="faint" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
