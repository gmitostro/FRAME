import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { Stepper, Switch } from '../../components/Stepper'
import type { SetLog } from '../../domain/types'
import { t } from '../../i18n'

interface Props {
  set: SetLog | null
  stepKg: number
  onClose: () => void
  onSave: (patch: { weightKg: number; reps: number; rir: number | null; formIssue: boolean; kind: SetLog['kind'] }) => void
  onDelete: () => void
}

export function SetEditSheet(props: Props) {
  if (!props.set) return null
  return <SetEditBody key={props.set.id} {...props} set={props.set} />
}

function SetEditBody({ set, stepKg, onClose, onSave, onDelete }: Props & { set: SetLog }) {
  const [weight, setWeight] = useState(set.weightKg)
  const [reps, setReps] = useState(set.reps)
  const [rir, setRir] = useState<number | null>(set.rir)
  const [form, setForm] = useState(Boolean(set.formIssue))
  const [kind, setKind] = useState<SetLog['kind']>(set.kind)

  return (
    <Sheet
      open
      title={t('workout.editSet')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-danger btn-block" onClick={onDelete}>
            {t('workout.deleteSet')}
          </button>
          <button className="btn btn-primary btn-block" onClick={() => onSave({ weightKg: weight, reps, rir: kind === 'working' ? rir : null, formIssue: form, kind })}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="segmented" role="group">
        <button aria-pressed={kind === 'warmup'} onClick={() => setKind('warmup')}>{t('workout.warmup')}</button>
        <button aria-pressed={kind === 'working'} onClick={() => setKind('working')}>{t('workout.working', { n: '' }).trim()}</button>
      </div>
      <div className="field">
        <span className="field-label">{t('workout.weight')} (kg)</span>
        <Stepper size="lg" label={t('workout.weight')} value={weight} step={stepKg} min={0} max={1000} editable onChange={setWeight} />
      </div>
      <div className="field">
        <span className="field-label">{t('workout.reps')}</span>
        <Stepper size="lg" label={t('workout.reps')} value={reps} min={0} max={100} onChange={setReps} />
      </div>
      {kind === 'working' && (
        <>
          <div className="field">
            <span className="field-label">{t('workout.rir')}</span>
            <div className="segmented rir-seg" role="group" aria-label={t('workout.rir')}>
              {[0, 1, 2, 3, 4, 5].map((r) => (
                <button key={r} aria-pressed={rir === r} onClick={() => setRir(r)}>
                  {r === 5 ? '5+' : r}
                </button>
              ))}
            </div>
          </div>
          <div className="switch-row">
            <span className="stack" style={{ gap: 2 }}>
              <span>{t('workout.formIssue')}</span>
              <span className="xs faint">{t('workout.formIssueHelp')}</span>
            </span>
            <Switch checked={form} onChange={setForm} label={t('workout.formIssue')} />
          </div>
        </>
      )}
    </Sheet>
  )
}
