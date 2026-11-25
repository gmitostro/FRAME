import { Check, Flame } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Stepper } from '../../components/Stepper'
import type { SetKind } from '../../domain/types'
import { t } from '../../i18n'
import type { LoggerDefaults } from './prefill'

interface Props {
  defaults: LoggerDefaults
  /** Accessible name, e.g. "Série 2". */
  label: string
  /** Visible set progress (pills) shown in the header. */
  progress: ReactNode
  /** Button text, e.g. "Concluir série 2". */
  submitLabel: string
  stepKg: number
  onSubmit: (v: { kind: SetKind; weightKg: number; reps: number; rir: number | null }) => Promise<unknown>
  onKindChange: (kind: SetKind) => void
}

const RIR_OPTIONS = [0, 1, 2, 3, 4, 5]

/** The set entry card: everything pre-filled, one tap to log. */
export function SetLogger({ defaults, label, progress, submitLabel, stepKg, onSubmit, onKindChange }: Props) {
  const [weight, setWeight] = useState(defaults.weightKg)
  const [reps, setReps] = useState(defaults.reps)
  const [rir, setRir] = useState(defaults.rir)
  // Blocks double taps: the logger remounts with fresh defaults once saved.
  const [busy, setBusy] = useState(false)
  const warm = defaults.kind === 'warmup'

  return (
    <section className="logger" aria-label={label}>
      <div className="logger-head">
        {progress}
        <button
          className="chip"
          aria-pressed={warm}
          aria-label={t('workout.warmupToggle')}
          title={t('workout.warmupToggle')}
          onClick={() => onKindChange(warm ? 'working' : 'warmup')}
        >
          <Flame size={14} /> {t('workout.warmupShort')}
        </button>
      </div>
      <div className="logger-grid">
        <div className="field">
          <span className="field-label">{t('workout.weight')} (kg)</span>
          <Stepper size="lg" label={t('workout.weight')} value={weight} step={stepKg} min={0} max={1000} editable onChange={setWeight} />
        </div>
        <div className="field">
          <span className="field-label">{t('workout.reps')}</span>
          <Stepper size="lg" label={t('workout.reps')} value={reps} step={1} min={0} max={100} onChange={setReps} />
        </div>
      </div>
      {!warm && (
        <div className="field">
          <span className="field-label">
            <span>{t('workout.rir')}</span>
            <span className="faint">{t('workout.rirHelp')}</span>
          </span>
          <div className="segmented rir-seg" role="group" aria-label={t('workout.rir')}>
            {RIR_OPTIONS.map((r) => (
              <button key={r} aria-pressed={rir === r} onClick={() => setRir(r)}>
                {r === 5 ? '5+' : r}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        className="btn btn-primary btn-lg btn-block logger-submit"
        disabled={busy}
        onClick={async () => {
          if (busy) return
          setBusy(true)
          try {
            await onSubmit({ kind: defaults.kind, weightKg: weight, reps, rir: warm ? null : rir })
          } finally {
            setBusy(false)
          }
        }}
      >
        <Check size={22} /> {submitLabel}
      </button>
    </section>
  )
}
