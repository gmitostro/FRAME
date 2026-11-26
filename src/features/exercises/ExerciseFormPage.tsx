import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Stepper, Switch } from '../../components/Stepper'
import { useToast } from '../../components/Toast'
import { db } from '../../data/db'
import { createExercise, updateExercise, type NewExercise } from '../../data/repo'
import { loadProfile, weightMeaning } from '../../domain/load'
import {
  EQUIPMENT,
  EXERCISE_CATEGORIES,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  REST_PROFILES,
  LOAD_TYPES,
  LOAD_BASES,
  type Exercise,
  type MuscleGroup,
} from '../../domain/types'
import { categoryLabel, equipmentLabel, loadBasisLabel, loadTypeLabel, muscleLabel, patternLabel, restProfileLabel, t } from '../../i18n'
import { useSafe } from '../shared'

const EMPTY: NewExercise = {
  namePt: '',
  nameEn: '',
  primaryMuscle: 'biceps',
  secondaryMuscles: [],
  equipment: 'dumbbell',
  pattern: 'elbowFlexion',
  category: 'isolation',
  restProfile: 'isolation',
  loadStepKg: 2,
  lowerBody: false,
}

export function ExerciseFormPage() {
  const { id } = useParams()
  const editing = useLiveQuery(async () => (id ? (await db.exercises.get(id)) ?? null : null), [id])
  if (editing === undefined) return null
  return <ExerciseForm key={editing?.id ?? 'new'} id={id} editing={editing} />
}

/** Classification shown in the form: the effective one (explicit, library or equipment default). */
function classification(ex: Pick<Exercise, 'id' | 'equipment' | 'loadType' | 'loadBasis' | 'unilateral' | 'measure'>) {
  const p = loadProfile(ex)
  return { loadType: p.loadType, loadBasis: p.loadBasis, unilateral: p.unilateral, measure: p.measure }
}

function toForm(ex: Exercise | null): NewExercise {
  if (!ex) return { ...EMPTY, ...classification({ id: '', equipment: EMPTY.equipment }) }
  const { id: _id, isCustom: _c, createdAt: _a, updatedAt: _u, ...rest } = ex
  void [_id, _c, _a, _u]
  return { ...EMPTY, ...rest, ...classification(ex) }
}

function ExerciseForm({ id, editing }: { id?: string; editing: Exercise | null }) {
  const [form, setForm] = useState<NewExercise>(() => toForm(editing))
  const [error, setError] = useState<string | null>(null)
  // Until the user picks a load type/basis, follow the equipment's default.
  const [classTouched, setClassTouched] = useState(Boolean(editing?.loadType || editing?.loadBasis))
  const navigate = useNavigate()
  const toast = useToast()
  const safe = useSafe()
  const set = <K extends keyof NewExercise>(k: K, v: NewExercise[K]) => setForm((f) => ({ ...f, [k]: v }))
  const toggleSecondary = (m: MuscleGroup) =>
    set('secondaryMuscles', form.secondaryMuscles.includes(m) ? form.secondaryMuscles.filter((x) => x !== m) : [...form.secondaryMuscles, m])

  async function save() {
    if (!form.namePt.trim()) {
      setError(t('exercises.nameRequired'))
      return
    }
    const data = { ...form, namePt: form.namePt.trim(), nameEn: form.nameEn?.trim() || undefined, secondaryMuscles: form.secondaryMuscles.filter((m) => m !== form.primaryMuscle) }
    await safe(async () => {
      if (id && editing) {
        await updateExercise(id, data)
        toast.show(t('exercises.saved'))
        navigate(-1)
      } else {
        const ex = await createExercise(data)
        toast.show(t('exercises.created'))
        navigate(`/exercicios/${ex.id}`, { replace: true })
      }
    })
  }

  return (
    <div className="page">
      <PageHeader title={id ? editing?.namePt ?? '' : t('exercises.newExercise')} eyebrow={id ? t('common.edit') : t('exercises.library')} back={true} />
      <section className="card">
        <div className="field">
          <label htmlFor="ex-name">{t('exercises.name')}</label>
          <input id="ex-name" className="input" value={form.namePt} maxLength={60} onChange={(e) => { set('namePt', e.target.value); setError(null) }} />
          {error && <span className="small" style={{ color: 'var(--danger)' }}>{error}</span>}
        </div>
        <div className="field">
          <label htmlFor="ex-name-en">{t('exercises.nameEn')} <span className="faint">({t('common.optional')})</span></label>
          <input id="ex-name-en" className="input" value={form.nameEn ?? ''} maxLength={60} onChange={(e) => set('nameEn', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ex-primary">{t('exercises.primaryMuscle')}</label>
          <select id="ex-primary" className="select" value={form.primaryMuscle} onChange={(e) => set('primaryMuscle', e.target.value as MuscleGroup)}>
            {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{muscleLabel(m)}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="field-label">{t('exercises.secondaryMuscles')}</span>
          <div className="chips wrap">
            {MUSCLE_GROUPS.filter((m) => m !== form.primaryMuscle).map((m) => (
              <button key={m} className="chip" aria-pressed={form.secondaryMuscles.includes(m)} onClick={() => toggleSecondary(m)}>{muscleLabel(m)}</button>
            ))}
          </div>
        </div>
      </section>
      <section className="card">
        <div className="field">
          <label htmlFor="ex-eq">{t('exercises.equipment')}</label>
          <select
            id="ex-eq"
            className="select"
            value={form.equipment}
            onChange={(e) => {
              const equipment = e.target.value as NewExercise['equipment']
              setForm((f) => {
                if (classTouched) return { ...f, equipment }
                const c = classification({ id: editing?.id ?? '', equipment })
                return { ...f, equipment, loadType: c.loadType, loadBasis: c.loadBasis }
              })
            }}
          >
            {EQUIPMENT.map((x) => <option key={x} value={x}>{equipmentLabel(x)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ex-pattern">{t('exercises.pattern')}</label>
          <select id="ex-pattern" className="select" value={form.pattern} onChange={(e) => set('pattern', e.target.value as NewExercise['pattern'])}>
            {MOVEMENT_PATTERNS.map((x) => <option key={x} value={x}>{patternLabel(x)}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="field-label">{t('exercises.category')}</span>
          <div className="segmented">
            {EXERCISE_CATEGORIES.map((c) => (
              <button key={c} aria-pressed={form.category === c} onClick={() => set('category', c)}>{categoryLabel(c)}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="ex-rest">{t('exercises.restProfile')}</label>
          <select id="ex-rest" className="select" value={form.restProfile} onChange={(e) => set('restProfile', e.target.value as NewExercise['restProfile'])}>
            {REST_PROFILES.map((r) => <option key={r} value={r}>{restProfileLabel(r)}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="field-label">{t('exercises.loadStep')}</span>
          <Stepper label={t('exercises.loadStep')} value={form.loadStepKg} step={0.5} min={0.5} max={20} unit="kg" onChange={(v) => set('loadStepKg', v)} />
        </div>
        <div className="switch-row">
          <span>{t('exercises.lowerBody')}</span>
          <Switch checked={form.lowerBody} onChange={(v) => set('lowerBody', v)} label={t('exercises.lowerBody')} />
        </div>
      </section>
      <section className="card">
        <div className="field">
          <label htmlFor="ex-load-type">{t('exercises.loadType')}</label>
          <select
            id="ex-load-type"
            className="select"
            value={form.loadType}
            onChange={(e) => {
              setClassTouched(true)
              set('loadType', e.target.value as NewExercise['loadType'])
            }}
          >
            {LOAD_TYPES.map((x) => <option key={x} value={x}>{loadTypeLabel(x)}</option>)}
          </select>
        </div>
        {form.loadType === 'external' && (
          <div className="field">
            <span className="field-label">{t('exercises.loadBasis')}</span>
            <div className="segmented" role="group" aria-label={t('exercises.loadBasis')}>
              {LOAD_BASES.map((b) => (
                <button
                  key={b}
                  aria-pressed={form.loadBasis === b}
                  onClick={() => {
                    setClassTouched(true)
                    set('loadBasis', b)
                  }}
                >
                  {loadBasisLabel(b)}
                </button>
              ))}
            </div>
          </div>
        )}
        <span className="field-note">{t(`exercises.loadHelp.${weightMeaning(loadProfile({ id: '', equipment: form.equipment, loadType: form.loadType, loadBasis: form.loadBasis }))}`)}</span>
        <div className="switch-row">
          <span className="stack" style={{ gap: 2 }}>
            <span>{t('exercises.unilateral')}</span>
            <span className="xs faint">{t('exercises.unilateralHelp')}</span>
          </span>
          <Switch checked={Boolean(form.unilateral)} onChange={(v) => set('unilateral', v)} label={t('exercises.unilateral')} />
        </div>
      </section>
      <button className="btn btn-primary btn-lg btn-block" onClick={save}>{t('common.save')}</button>
    </div>
  )
}
