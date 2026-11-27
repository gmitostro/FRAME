import { ChevronLeft, ChevronRight, Info, Star, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useCompletedSessions, useExerciseMap, useNow, useProgram, useSettings } from '../../app/hooks'
import { PageHeader } from '../../components/PageHeader'
import { performedVolume, plannedVolume, VOLUME_REFERENCE, volumeRows, type VolumeRow } from '../../domain/volume'
import { addWeeks, startOfWeek } from '../../domain/week'
import { formatShortDate, muscleLabel, t, volumeHowLines } from '../../i18n'

const REF = { min: VOLUME_REFERENCE.min, high: VOLUME_REFERENCE.high }

export function VolumePage() {
  const program = useProgram()
  const settings = useSettings()
  const exMap = useExerciseMap()
  const sessions = useCompletedSessions()
  const now = useNow(60_000)
  const [offset, setOffset] = useState(0)

  const weekStart = addWeeks(startOfWeek(now), offset)
  const weekEnd = addWeeks(weekStart, 1)

  const data = useMemo(() => {
    if (!program || !settings || !exMap || !sessions) return null
    const lookup = (id: string) => exMap.get(id)
    const planned = plannedVolume(program.templates, lookup)
    const performed = performedVolume(sessions, lookup, weekStart, weekEnd)
    const rows = volumeRows(planned.volume, performed.volume, settings.priorities)
    return { rows, performed, unknownSets: planned.unknownSets + performed.unknownSets }
  }, [program, settings, exMap, sessions, weekStart, weekEnd])

  if (!data) return null
  const { rows, performed, unknownSets } = data
  const priorityRows = rows.filter((r) => r.tier)
  const otherRows = rows.filter((r) => !r.tier)
  const below = priorityRows.filter((r) => r.plannedStatus === 'none' || r.plannedStatus === 'below')

  return (
    <div className="page">
      <PageHeader title={t('volume.title')} eyebrow={t('volume.eyebrow')} back="/" />

      <div className="row between volume-week">
        <button className="btn btn-ghost btn-icon" aria-label={t('volume.prevWeek')} onClick={() => setOffset(offset - 1)}>
          <ChevronLeft size={22} />
        </button>
        <div className="stack" style={{ gap: 0, alignItems: 'center' }}>
          <span style={{ fontWeight: 650 }}>{offset === 0 ? t('volume.thisWeek') : t('volume.weekOf', { date: formatShortDate(weekStart) })}</span>
          <span className="xs muted">{performed.sessions === 1 ? t('volume.sessionsOne') : t('volume.sessions', { n: performed.sessions })}</span>
        </div>
        <button className="btn btn-ghost btn-icon" aria-label={t('volume.nextWeek')} disabled={offset >= 0} onClick={() => setOffset(Math.min(0, offset + 1))}>
          <ChevronRight size={22} />
        </button>
      </div>

      {priorityRows.length === 0 ? (
        <div className="notice">
          <Info size={16} />
          <span>{t('volume.noPriorities')}</span>
        </div>
      ) : below.length > 0 ? (
        <div className="notice warn">
          <TriangleAlert size={16} />
          <span>{t('volume.prioritiesBelow', { min: REF.min, list: below.map((r) => muscleLabel(r.muscle)).join(', ') })}</span>
        </div>
      ) : (
        <div className="notice accent">
          <Info size={16} />
          <span>{t('volume.prioritiesOk', { min: REF.min })}</span>
        </div>
      )}

      <Legend />

      {priorityRows.length > 0 && (
        <section className="section">
          <div className="section-title">{t('volume.priorities')}</div>
          <div className="list">
            {priorityRows.map((r) => (
              <MuscleRow key={r.muscle} row={r} />
            ))}
          </div>
        </section>
      )}

      {otherRows.length > 0 && (
        <section className="section">
          <div className="section-title">{t('volume.others')}</div>
          <div className="list">
            {otherRows.map((r) => (
              <MuscleRow key={r.muscle} row={r} />
            ))}
          </div>
        </section>
      )}

      {unknownSets > 0 && <p className="xs muted">{t('volume.unknownSets', { n: unknownSets })}</p>}

      <section className="section">
        <div className="section-title">{t('volume.howTitle')}</div>
        <ul className="volume-how small muted">
          {volumeHowLines().map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Legend() {
  return (
    <div className="volume-legend xs muted" aria-hidden="true">
      <span><i className="sw done" /> {t('volume.legendDone')}</span>
      <span><i className="sw planned" /> {t('volume.legendPlanned')}</span>
      <span><i className="sw ref" /> {t('volume.legendRef', REF)}</span>
    </div>
  )
}

function MuscleRow({ row }: { row: VolumeRow }) {
  const { planned, performed } = row
  const scale = Math.max(25, planned.direct, performed.direct)
  const pct = (n: number) => `${Math.min(100, (n / scale) * 100)}%`
  const statusCls = row.plannedStatus === 'within' ? 'ok' : row.plannedStatus === 'above' ? '' : row.tier ? 'warn' : ''
  return (
    <div className="list-row volume-row" data-muscle={row.muscle}>
      <div className="row between" style={{ gap: 8 }}>
        <span className="title">
          {muscleLabel(row.muscle)}
          {row.tier && (
            <span className={`badge ${row.tier === 'primary' ? 'accent' : ''}`} style={{ marginLeft: 8 }}>
              <Star size={11} /> {row.tier === 'primary' ? t('volume.primary') : t('volume.secondary')}
            </span>
          )}
        </span>
      </div>
      <div
        className="volume-bar"
        role="img"
        aria-label={`${t('volume.direct')}: ${t('volume.doneOfPlanned', { done: performed.direct, planned: planned.direct })}`}
      >
        <b className="ref" style={{ left: pct(REF.min), width: `calc(${pct(REF.high)} - ${pct(REF.min)})` }} />
        <span className="planned" style={{ width: pct(planned.direct) }} />
        <span className="done" style={{ width: pct(performed.direct) }} />
      </div>
      <div className="volume-nums small">
        <span>
          <span className="muted">{t('volume.direct')}</span>{' '}
          <strong className="num">{t('volume.doneOfPlanned', { done: performed.direct, planned: planned.direct })}</strong>
        </span>
        <span>
          <span className="muted">{t('volume.indirect')}</span>{' '}
          <span className="num">{t('volume.doneOfPlanned', { done: performed.indirect, planned: planned.indirect })}</span>
        </span>
      </div>
      <span className={`xs volume-status ${statusCls}`}>{t(`volume.status.${row.plannedStatus}`, REF)}</span>
    </div>
  )
}
