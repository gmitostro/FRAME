import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSettings } from '../../app/hooks'
import { PageHeader } from '../../components/PageHeader'
import { db } from '../../data/db'
import { exerciseHistory, updateExercise } from '../../data/repo'
import { loadProfile } from '../../domain/load'
import { computeRecords } from '../../domain/records'
import { categoryLabel, equipmentLabel, formatDate, formatKg, formatNumber, formatRest, loadBasisLabel, loadTypeLabel, measureLabel, muscleLabel, patternLabel, restProfileLabel, t } from '../../i18n'
import { useSafe } from '../shared'

export function ExerciseDetailPage() {
  const { id = '' } = useParams()
  const ex = useLiveQuery(() => db.exercises.get(id), [id])
  const history = useLiveQuery(() => exerciseHistory(id), [id])
  const settings = useSettings()
  const safe = useSafe()

  if (ex === undefined || history === undefined || !settings) return null
  if (!ex) return <div className="page"><PageHeader title={t('errors.notFound')} back="/exercicios" /></div>
  const records = computeRecords(history)

  return (
    <div className="page">
      <PageHeader
        title={ex.namePt}
        eyebrow={ex.nameEn}
        back={true}
        actions={
          <Link to={`/exercicios/${ex.id}/editar`} className="btn btn-ghost btn-icon" aria-label={t('common.edit')}>
            <Pencil size={20} />
          </Link>
        }
      />
      <section className="card">
        <Info label={t('exercises.primaryMuscle')} value={muscleLabel(ex.primaryMuscle)} />
        {ex.secondaryMuscles.length > 0 && <Info label={t('exercises.secondaryMuscles')} value={ex.secondaryMuscles.map(muscleLabel).join(', ')} />}
        <Info label={t('exercises.equipment')} value={equipmentLabel(ex.equipment)} />
        <Info label={t('exercises.pattern')} value={patternLabel(ex.pattern)} />
        <Info label={t('exercises.category')} value={categoryLabel(ex.category)} />
        <Info label={t('exercises.restProfile')} value={`${restProfileLabel(ex.restProfile)} · ${formatRest(Math.max(settings.minRestSec, settings.restProfiles[ex.restProfile]))}`} />
        <Info label={t('exercises.loadStep')} value={formatKg(ex.loadStepKg)} />
        {(() => {
          const lp = loadProfile(ex)
          return (
            <>
              <Info label={t('exercises.loadType')} value={loadTypeLabel(lp.loadType)} />
              {lp.loadType === 'external' && <Info label={t('exercises.loadBasis')} value={loadBasisLabel(lp.loadBasis)} />}
              <Info label={t('exercises.unilateral')} value={lp.unilateral ? t('common.yes') : t('common.no')} />
              <Info label={t('exercises.measure')} value={measureLabel(lp.measure)} />
            </>
          )
        })()}
      </section>

      <section className="section">
        <div className="section-title">{t('exercises.records')}</div>
        {records.bestLoad ? (
          <div className="grid-2">
            <div className="card tight">
              <div className="stat">
                <span className="stat-value">{t('exercises.bestLoadValue', { kg: formatKg(records.bestLoad.weightKg), reps: records.bestLoad.reps })}</span>
                <span className="stat-label">{t('exercises.bestLoad')}</span>
                <span className="xs faint">{formatDate(records.bestLoad.date)}</span>
              </div>
            </div>
            {records.bestSetVolume && (
              <div className="card tight">
                <div className="stat">
                  <span className="stat-value">{t('exercises.bestLoadValue', { kg: formatKg(records.bestSetVolume.weightKg), reps: records.bestSetVolume.reps })}</span>
                  <span className="stat-label">{t('exercises.bestSetVolume')}</span>
                  <span className="xs faint">{formatDate(records.bestSetVolume.date)}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="muted small">{t('exercises.noHistory')}</p>
        )}
        {records.bestLoad && <p className="xs faint">{t('exercises.recordsNote')}</p>}
      </section>

      <ExerciseNotes key={ex.notes ?? ''} initial={ex.notes ?? ''} onSave={(notes) => safe(() => updateExercise(ex.id, { notes }))} />

      {history.length > 0 && (
        <section className="section">
          <div className="section-title">{t('exercises.history')}</div>
          <div className="list">
            {history.slice(0, 30).map((h) => (
              <Link key={h.sessionId} to={`/historico/${h.sessionId}`} className="list-row">
                <span className="num faint small" style={{ minWidth: 86 }}>{formatDate(h.date)}</span>
                <span className="grow num small">
                  {h.working.map((x) => `${formatNumber(x.weightKg)} × ${x.reps}`).join(' · ') || '—'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="row between small" style={{ alignItems: 'flex-start' }}>
      <span className="muted">{label}</span>
      <span style={{ textAlign: 'right', fontWeight: 550 }}>{value}</span>
    </div>
  )
}

function ExerciseNotes({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [notes, setNotes] = useState(initial)
  return (
    <section className="card">
      <div className="field">
        <label htmlFor="ex-notes">{t('exercises.notes')}</label>
        <textarea id="ex-notes" className="textarea" value={notes} placeholder={t('exercises.notesPlaceholder')} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== initial && onSave(notes)} />
      </div>
    </section>
  )
}
