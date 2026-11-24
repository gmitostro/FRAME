import { ChevronRight, Plus, Search, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useExercises, useSettings } from '../../app/hooks'
import { PageHeader } from '../../components/PageHeader'
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type MuscleGroup } from '../../domain/types'
import { categoryLabel, equipmentLabel, muscleLabel, t } from '../../i18n'
import { filterExercises } from './search'

export function ExerciseLibraryPage() {
  const all = useExercises()
  const settings = useSettings()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null)
  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [priorityOnly, setPriorityOnly] = useState(false)

  const list = useMemo(() => {
    if (!all || !settings) return []
    const prio = new Set([...settings.priorities.primary, ...settings.priorities.secondary])
    return filterExercises(all, q, muscle).filter((e) => (!equipment || e.equipment === equipment) && (!priorityOnly || prio.has(e.primaryMuscle)))
  }, [all, settings, q, muscle, equipment, priorityOnly])

  if (!all || !settings) return null
  const prio = new Set<MuscleGroup>([...settings.priorities.primary, ...settings.priorities.secondary])

  return (
    <div className="page">
      <PageHeader
        title={t('exercises.title')}
        actions={
          <Link to="/exercicios/novo" className="btn btn-ghost btn-icon" aria-label={t('exercises.newExercise')}>
            <Plus size={22} />
          </Link>
        }
      />
      <div className="search">
        <Search size={18} />
        <input className="input" type="search" placeholder={t('picker.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('common.search')} />
      </div>
      <div className="stack">
        <div className="chips" aria-label={t('exercises.filterMuscle')}>
          <button className="chip" aria-pressed={priorityOnly} onClick={() => setPriorityOnly(!priorityOnly)}>
            <Star size={14} /> {t('exercises.priorityOnly')}
          </button>
          {MUSCLE_GROUPS.map((m) => (
            <button key={m} className="chip" aria-pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
              {muscleLabel(m)}
            </button>
          ))}
        </div>
        <div className="chips" aria-label={t('exercises.filterEquipment')}>
          {EQUIPMENT.map((e) => (
            <button key={e} className="chip" aria-pressed={equipment === e} onClick={() => setEquipment(equipment === e ? null : e)}>
              {equipmentLabel(e)}
            </button>
          ))}
        </div>
      </div>
      <p className="xs faint">{t('exercises.count', { n: list.length })}</p>
      {list.length === 0 ? (
        <p className="muted small">{t('picker.noResults')}</p>
      ) : (
        <div className="list">
          {list.map((ex) => (
            <Link key={ex.id} to={`/exercicios/${ex.id}`} className="list-row">
              <span className="grow">
                <span className="title" style={{ display: 'block' }}>
                  {ex.namePt}
                  {prio.has(ex.primaryMuscle) && (
                    <Star size={12} color="var(--accent)" fill="var(--accent)" style={{ marginLeft: 6, verticalAlign: '0' }} aria-label={t('exercises.priorityOnly')} />
                  )}
                </span>
                <span className="sub">
                  {muscleLabel(ex.primaryMuscle)} · {equipmentLabel(ex.equipment)} · {categoryLabel(ex.category)}
                  {ex.isCustom && ` · ${t('exercises.custom')}`}
                </span>
              </span>
              <ChevronRight size={18} className="faint" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
