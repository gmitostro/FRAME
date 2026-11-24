import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useExercises } from '../../app/hooks'
import { Sheet } from '../../components/Sheet'
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../../domain/types'
import { equipmentLabel, muscleLabel, t } from '../../i18n'
import { filterExercises, substitutionCandidates } from './search'

interface Props {
  open: boolean
  title?: string
  onClose: () => void
  onPick: (ex: Exercise) => void
  /** When set, shows substitution suggestions for this exercise first. */
  suggestFor?: Exercise
  note?: string
}

export function ExercisePicker({ open, title, onClose, onPick, suggestFor, note }: Props) {
  const all = useExercises()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null)

  const groups = useMemo(() => {
    if (!all) return null
    const filtered = filterExercises(all, q, muscle)
    if (!suggestFor || q || muscle) return [{ key: 'all', label: null as string | null, items: filtered.filter((e) => e.id !== suggestFor?.id) }]
    const { suggested, others } = substitutionCandidates(suggestFor, filtered)
    return [
      { key: 's', label: t('picker.suggested'), items: suggested },
      { key: 'o', label: t('picker.others'), items: others },
    ]
  }, [all, q, muscle, suggestFor])

  return (
    <Sheet open={open} title={title ?? t('picker.title')} onClose={onClose}>
      {note && <p className="small muted">{note}</p>}
      <div className="search">
        <Search size={18} />
        <input className="input" type="search" placeholder={t('picker.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('picker.searchPlaceholder')} />
      </div>
      <div className="chips">
        <button className="chip" aria-pressed={muscle === null} onClick={() => setMuscle(null)}>
          {t('common.all')}
        </button>
        {MUSCLE_GROUPS.map((m) => (
          <button key={m} className="chip" aria-pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
            {muscleLabel(m)}
          </button>
        ))}
      </div>
      {groups?.map((g) =>
        g.items.length === 0 ? null : (
          <div key={g.key} className="stack">
            {g.label && <div className="section-title">{g.label}</div>}
            <div className="list">
              {g.items.map((ex) => (
                <button key={ex.id} className="list-row" onClick={() => onPick(ex)}>
                  <span className="grow">
                    <span className="title" style={{ display: 'block' }}>{ex.namePt}</span>
                    <span className="sub">
                      {muscleLabel(ex.primaryMuscle)} · {equipmentLabel(ex.equipment)}
                    </span>
                  </span>
                  <Plus size={18} className="faint" />
                </button>
              ))}
            </div>
          </div>
        ),
      )}
      {groups && groups.every((g) => g.items.length === 0) && <p className="muted small">{t('picker.noResults')}</p>}
      <Link to="/exercicios/novo" className="btn btn-block">
        <Plus size={18} /> {t('picker.createCustom')}
      </Link>
    </Sheet>
  )
}
