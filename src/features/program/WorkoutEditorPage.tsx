import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, Clock, Plus, StickyNote, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useExerciseMap, useSettings } from '../../app/hooks'
import { PageHeader } from '../../components/PageHeader'
import { ConfirmSheet } from '../../components/Sheet'
import { Stepper } from '../../components/Stepper'
import { db } from '../../data/db'
import * as R from '../../data/repo'
import { durationStatus, estimateExercise, resolveRestSec } from '../../domain/duration'
import type { Exercise, Settings, TemplateExercise, WorkoutTemplate } from '../../domain/types'
import { WEEK_ORDER } from '../../domain/week'
import { formatDuration, formatRest, muscleLabel, t, weekdayShort } from '../../i18n'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { templateEstimate, useSafe } from '../shared'

export function WorkoutEditorPage() {
  const { id = '' } = useParams()
  const tpl = useLiveQuery(() => db.templates.get(id), [id])
  const exMap = useExerciseMap()
  const settings = useSettings()
  const safe = useSafe()
  const navigate = useNavigate()
  const [picker, setPicker] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [removing, setRemoving] = useState<TemplateExercise | null>(null)

  if (tpl === undefined || !exMap || !settings) return null
  if (tpl === null || !tpl) {
    return (
      <div className="page">
        <PageHeader title={t('errors.notFound')} back="/treinos" />
      </div>
    )
  }

  const est = templateEstimate(tpl, exMap, settings)
  const status = durationStatus(est.totalSec, settings.targetDurationMin)
  const pct = Math.min(1, est.totalSec / 60 / (settings.targetDurationMin * 1.5))
  const targetPos = settings.targetDurationMin / (settings.targetDurationMin * 1.5)

  return (
    <div className="page">
      <PageHeader
        title={tpl.name}
        eyebrow={t('program.editWorkout')}
        back="/treinos"
        actions={
          <button className="btn btn-ghost btn-icon" aria-label={t('program.deleteWorkout')} onClick={() => setConfirmDelete(true)}>
            <Trash2 size={20} />
          </button>
        }
      />

      <section className="card">
        <NameField key={tpl.name} tpl={tpl} onSave={(name) => safe(() => R.updateTemplate(tpl.id, { name }))} />
        <div className="field">
          <span className="field-label">{t('program.weekday')}</span>
          <div className="chips wrap">
            {WEEK_ORDER.map((d) => (
              <button key={d} className="chip" aria-pressed={tpl.weekday === d} onClick={() => safe(() => R.updateTemplate(tpl.id, { weekday: tpl.weekday === d ? null : d }))}>
                {weekdayShort(d)}
              </button>
            ))}
          </div>
          {tpl.weekday === null && <span className="field-note">{t('program.unscheduled')}</span>}
        </div>
      </section>

      <section className="card" aria-live="polite">
        <div className="row between">
          <span className="row small muted">
            <Clock size={16} /> {t('program.duration')}
          </span>
          <span className="num" style={{ fontWeight: 650, fontSize: 'var(--fs-lg)' }}>
            {est.totalSec > 0 ? `~${formatDuration(est.totalSec * 1000)}` : '—'}
          </span>
        </div>
        <div className={`duration-bar ${status === 'over' ? 'over' : ''}`}>
          <span style={{ width: `${pct * 100}%` }} />
          <i style={{ left: `${targetPos * 100}%` }} />
        </div>
        <div className="row between xs faint">
          <span>{t('program.durationTarget', { min: settings.targetDurationMin })}</span>
          <span>
            {status === 'over' ? t('program.durationOver').split('.')[0] : status === 'under' ? t('program.durationUnder') : status === 'onTarget' ? t('program.durationOnTarget') : ''}
          </span>
        </div>
        {status === 'over' && <p className="small" style={{ color: 'var(--warn)' }}>{t('program.durationOver')}</p>}
        {est.totalSec > 0 && <p className="xs faint">{t('program.durationBreakdown', { warmup: settings.durationModel.generalWarmupMin })}</p>}
      </section>

      <section className="section">
        <div className="section-title">{t('nav.exercises')}</div>
        {tpl.exercises.length === 0 && <p className="muted small">{t('program.noExercises')}</p>}
        {tpl.exercises.map((te, i) => (
          <TemplateExerciseCard
            key={te.id}
            te={te}
            index={i}
            count={tpl.exercises.length}
            exercise={exMap.get(te.exerciseId)}
            settings={settings}
            onChange={(patch) => safe(() => R.updateTemplateExercise(tpl.id, te.id, patch))}
            onMove={(d) => safe(() => R.moveTemplateExercise(tpl.id, te.id, d))}
            onRemove={() => setRemoving(te)}
          />
        ))}
        <button className="btn btn-block btn-lg" onClick={() => setPicker(true)}>
          <Plus size={20} /> {t('program.addExercise')}
        </button>
      </section>

      <section className="card">
        <NotesField key={`w-${tpl.warmupNotes ?? ''}`} label={t('program.warmupNotes')} placeholder={t('program.warmupNotesPlaceholder')} value={tpl.warmupNotes ?? ''} onSave={(v) => safe(() => R.updateTemplate(tpl.id, { warmupNotes: v }))} />
        <NotesField key={`n-${tpl.notes ?? ''}`} label={t('program.workoutNotes')} value={tpl.notes ?? ''} onSave={(v) => safe(() => R.updateTemplate(tpl.id, { notes: v }))} />
      </section>

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(ex) => {
          setPicker(false)
          void safe(() => R.addTemplateExercise(tpl.id, ex.id))
        }}
      />
      <ConfirmSheet
        open={confirmDelete}
        title={t('program.deleteWorkout')}
        body={t('program.deleteWorkoutConfirm', { name: tpl.name })}
        confirmLabel={t('common.delete')}
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          safe(async () => {
            await R.deleteTemplate(tpl.id)
            navigate('/treinos', { replace: true })
          })
        }
      />
      <ConfirmSheet
        open={removing !== null}
        title={t('program.removeExercise')}
        body={removing ? t('program.removeExerciseConfirm', { name: exMap.get(removing.exerciseId)?.namePt ?? '' }) : ''}
        confirmLabel={t('common.delete')}
        danger
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && safe(() => R.removeTemplateExercise(tpl.id, removing.id))}
      />
    </div>
  )
}

function NameField({ tpl, onSave }: { tpl: WorkoutTemplate; onSave: (v: string) => void }) {
  const [v, setV] = useState(tpl.name)
  return (
    <div className="field">
      <label htmlFor="tpl-name">{t('program.workoutName')}</label>
      <input
        id="tpl-name"
        className="input"
        value={v}
        maxLength={40}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const name = v.trim()
          if (name && name !== tpl.name) onSave(name)
          else setV(tpl.name)
        }}
      />
    </div>
  )
}

function NotesField({ label, value, placeholder, onSave }: { label: string; value: string; placeholder?: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  return (
    <div className="field">
      <label>{label}</label>
      <textarea className="textarea" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} />
    </div>
  )
}

interface CardProps {
  te: TemplateExercise
  index: number
  count: number
  exercise: Exercise | undefined
  settings: Settings
  onChange: (patch: Partial<Omit<TemplateExercise, 'id'>>) => void
  onMove: (d: -1 | 1) => void
  onRemove: () => void
}

function TemplateExerciseCard({ te, index, count, exercise, settings, onChange, onMove, onRemove }: CardProps) {
  const [showNotes, setShowNotes] = useState(Boolean(te.notes))
  const profileRest = Math.max(settings.minRestSec, exercise ? settings.restProfiles[exercise.restProfile] : settings.restProfiles.isolation)
  const rest = resolveRestSec(te, exercise?.restProfile, settings)
  const est = estimateExercise(te, exercise, settings, settings.durationModel)
  return (
    <article className="card" aria-label={exercise?.namePt}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="num faint" style={{ fontWeight: 650, minWidth: 18, marginTop: 2 }}>{index + 1}</span>
        <div className="grow stack" style={{ gap: 4 }}>
          <span style={{ fontWeight: 620, fontSize: 'var(--fs-lg)' }}>{exercise?.namePt ?? '—'}</span>
          <span className="row wrap" style={{ gap: 6 }}>
            {exercise && <span className="badge">{muscleLabel(exercise.primaryMuscle)}</span>}
            <span className="badge num">{t('program.perExercise', { time: formatDuration(est.totalSec * 1000) })}</span>
          </span>
        </div>
        <div className="row" style={{ gap: 0, marginRight: -8 }}>
          <button className="btn btn-ghost btn-icon btn-sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label={t('common.moveUp')}>
            <ArrowUp size={18} />
          </button>
          <button className="btn btn-ghost btn-icon btn-sm" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={t('common.moveDown')}>
            <ArrowDown size={18} />
          </button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onRemove} aria-label={t('program.removeExercise')}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <span className="field-label">{t('program.workingSets')}</span>
          <Stepper label={t('program.workingSets')} value={te.workingSets} min={1} max={10} onChange={(v) => onChange({ workingSets: v })} />
        </div>
        <div className="field">
          <span className="field-label">{t('program.warmupSets')}</span>
          <Stepper label={t('program.warmupSets')} value={te.warmupSets} min={0} max={6} onChange={(v) => onChange({ warmupSets: v })} />
        </div>
        <div className="field">
          <span className="field-label">{t('program.repRange')} · {t('program.repMin')}</span>
          <Stepper label={`${t('program.repRange')} ${t('program.repMin')}`} value={te.repMin} min={1} max={50} onChange={(v) => onChange({ repMin: v, repMax: Math.max(v, te.repMax) })} />
        </div>
        <div className="field">
          <span className="field-label">{t('program.repRange')} · {t('program.repMax')}</span>
          <Stepper label={`${t('program.repRange')} ${t('program.repMax')}`} value={te.repMax} min={te.repMin} max={60} onChange={(v) => onChange({ repMax: v })} />
        </div>
      </div>

      <div className="field">
        <span className="field-label">{t('program.rirTarget')}</span>
        <div className="segmented" role="group" aria-label={t('program.rirTarget')}>
          {[0, 1, 2, 3, 4].map((r) => (
            <button key={r} aria-pressed={te.rirTarget === r} onClick={() => onChange({ rirTarget: r })}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label row between">
          <span>{t('program.rest')}</span>
          {te.restSec !== null && (
            <button className="btn btn-ghost btn-sm" style={{ minHeight: 28 }} onClick={() => onChange({ restSec: null })}>
              {t('common.default')}
            </button>
          )}
        </span>
        <Stepper label={t('program.rest')} value={rest} step={15} min={settings.minRestSec} max={600} format={formatRest} onChange={(v) => onChange({ restSec: v })} />
        <span className="field-note">{te.restSec === null ? t('program.restDefault', { time: formatRest(profileRest) }) : t('program.restCustom')}</span>
      </div>

      {showNotes ? (
        <NotesField key={te.notes ?? ''} label={t('program.exerciseNotes')} value={te.notes ?? ''} onSave={(v) => onChange({ notes: v })} />
      ) : (
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowNotes(true)}>
          <StickyNote size={16} /> {t('program.exerciseNotes')}
        </button>
      )}
    </article>
  )
}
