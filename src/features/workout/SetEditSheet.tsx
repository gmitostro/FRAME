import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { Stepper, Switch } from '../../components/Stepper'
import type { LoadProfile, RirSource, SetLog } from '../../domain/types'
import { loadCaptions } from './captions'
import { t } from '../../i18n'

interface Props {
  set: SetLog | null
  stepKg: number
  profile: LoadProfile
  onClose: () => void
  onSave: (patch: { weightKg: number; reps: number; rir: number | null; rirSource?: RirSource; formIssue: boolean; kind: SetLog['kind'] }) => void
  onDelete: () => void
}

export function SetEditSheet(props: Props) {
  if (!props.set) return null
  return <SetEditBody key={props.set.id} {...props} set={props.set} />
}

function SetEditBody({ set, stepKg, profile, onClose, onSave, onDelete }: Props & { set: SetLog }) {
  const captions = loadCaptions(profile)
  const [weight, setWeight] = useState(set.weightKg)
  const [reps, setReps] = useState(set.reps)
  const [rir, setRir] = useState<number | null>(set.rir)
  const [form, setForm] = useState(Boolean(set.formIssue))
  const [kind, setKind] = useState<SetLog['kind']>(set.kind)
  // Picking an RIR here is a user choice; untouched keeps the stored origin.
  const [rirTouched, setRirTouched] = useState(false)

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
          <button className="btn btn-primary btn-block" onClick={() =>
              onSave({ weightKg: captions.weight === null ? 0 : weight, reps, rir: kind === 'working' ? rir : null, rirSource: rirTouched ? 'user' : undefined, formIssue: form, kind })
            }>
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="segmented" role="group">
        <button aria-pressed={kind === 'warmup'} onClick={() => setKind('warmup')}>{t('workout.warmup')}</button>
        <button aria-pressed={kind === 'working'} onClick={() => setKind('working')}>{t('workout.working', { n: '' }).trim()}</button>
      </div>
      {captions.weight !== null && (
        <div className="field">
          <span className="field-label">{captions.weight} (kg)</span>
          <Stepper size="lg" label={captions.weight} value={weight} step={stepKg} min={0} max={1000} editable onChange={setWeight} />
        </div>
      )}
      <div className="field">
        <span className="field-label">{captions.reps}</span>
        <Stepper size="lg" label={captions.reps} value={reps} min={0} max={100} onChange={setReps} />
      </div>
      {kind === 'working' && (
        <>
          <div className="field">
            <span className="field-label">{t('workout.rir')}</span>
            <div className="segmented rir-seg" role="group" aria-label={t('workout.rir')}>
              {[0, 1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  aria-pressed={rir === r}
                  onClick={() => {
                    setRir(r)
                    setRirTouched(true)
                  }}
                >
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
