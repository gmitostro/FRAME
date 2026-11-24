import { ChevronRight, Clock, Dumbbell, Layers, Play, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useExerciseMap, useProgram, useSettings } from '../../app/hooks'
import { PageHeader } from '../../components/PageHeader'
import { createTemplate } from '../../data/repo'
import { durationStatus } from '../../domain/duration'
import { formatDuration, t, weekdayLong } from '../../i18n'
import { exercisesLabel, templateEstimate, templateSetCount, useSafe, useStartWorkout } from '../shared'

export function ProgramPage() {
  const data = useProgram()
  const exMap = useExerciseMap()
  const settings = useSettings()
  const start = useStartWorkout()
  const safe = useSafe()
  const navigate = useNavigate()
  if (!data || !exMap || !settings) return null
  const { program, templates } = data

  return (
    <div className="page">
      <PageHeader title={t('program.title')} eyebrow={program ? t('program.subtitle', { name: program.name }) : undefined} />
      {!program && <p className="muted">{t('home.noProgram')}</p>}
      <div className="stack" style={{ gap: 'var(--s-3)' }}>
        {templates.map((tpl) => {
          const est = templateEstimate(tpl, exMap, settings)
          const status = durationStatus(est.totalSec, settings.targetDurationMin)
          return (
            <article key={tpl.id} className="card">
              <Link to={`/treinos/${tpl.id}`} className="row card-link" style={{ alignItems: 'flex-start' }}>
                <span className="grow stack" style={{ gap: 4 }}>
                  <span className="xs faint" style={{ fontWeight: 650, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {tpl.weekday === null ? t('program.unscheduled') : weekdayLong(tpl.weekday)}
                  </span>
                  <span className="card-title">{tpl.name}</span>
                </span>
                <ChevronRight size={20} className="faint" style={{ marginTop: 20 }} />
              </Link>
              {tpl.exercises.length === 0 ? (
                <p className="small muted">{t('program.empty')}</p>
              ) : (
                <div className="meta">
                  <span><Dumbbell size={15} /> {exercisesLabel(tpl.exercises.length)}</span>
                  <span><Layers size={15} /> {t('home.setsCount', { n: templateSetCount(tpl) })}</span>
                  <span style={{ color: status === 'over' ? 'var(--warn)' : undefined }}>
                    <Clock size={15} /> {t('home.estimated', { time: formatDuration(est.totalSec * 1000) })}
                  </span>
                </div>
              )}
              <div className="row">
                <Link to={`/treinos/${tpl.id}`} className="btn btn-sm grow">{t('common.edit')}</Link>
                {tpl.exercises.length > 0 && (
                  <button className="btn btn-sm btn-primary grow" onClick={() => start(tpl.id)}>
                    <Play size={16} /> {t('program.start')}
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {program && (
        <button
          className="btn btn-block"
          onClick={() =>
            safe(async () => {
              const tpl = await createTemplate(program.id, t('program.newWorkout'))
              navigate(`/treinos/${tpl.id}`)
            })
          }
        >
          <Plus size={18} /> {t('program.newWorkout')}
        </button>
      )}
    </div>
  )
}
