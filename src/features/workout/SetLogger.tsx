import { Check, Flame } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Stepper } from '../../components/Stepper'
import type { LoadProfile, RirSource, SetKind } from '../../domain/types'
import { t } from '../../i18n'
import { loadCaptions } from './captions'
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
  /** How this exercise's load is logged (captions, hidden weight). */
  profile: LoadProfile
  onSubmit: (v: { kind: SetKind; weightKg: number; reps: number; rir: number | null; rirSource?: RirSource }) => Promise<unknown>
  onKindChange: (kind: SetKind) => void
}

const RIR_OPTIONS = [0, 1, 2, 3, 4, 5]

/** The set entry card: everything pre-filled, one tap to log. */
export function SetLogger({ defaults, label, progress, submitLabel, stepKg, profile, onSubmit, onKindChange }: Props) {
  const [weight, setWeight] = useState(defaults.weightKg)
  const [reps, setReps] = useState(defaults.reps)
  const [rir, setRir] = useState(defaults.rir)
  // RIR stays a suggestion until the user taps a value; the origin is saved.
  const [rirTouched, setRirTouched] = useState(false)
  // Blocks double taps: the logger remounts with fresh defaults once saved.
  const [busy, setBusy] = useState(false)
  const warm = defaults.kind === 'warmup'
  const captions = loadCaptions(profile)

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
      <div className={`logger-grid ${captions.weight === null ? 'single' : ''}`}>
        {captions.weight !== null && (
          <div className="field">
            <span className="field-label">{captions.weight} (kg)</span>
            <Stepper size="lg" label={captions.weight} value={weight} step={stepKg} min={0} max={1000} editable onChange={setWeight} />
          </div>
        )}
        <div className="field">
          <span className="field-label">{captions.reps}</span>
          <Stepper size="lg" label={captions.reps} value={reps} step={1} min={0} max={100} onChange={setReps} />
        </div>
      </div>
      {!warm && (
        <div className="field">
          <span className="field-label">
            <span>{t('workout.rir')}</span>
            <span className="faint">{rirTouched ? t('workout.rirHelp') : t('workout.rirSuggested')}</span>
          </span>
          <div className="segmented rir-seg" role="group" aria-label={t('workout.rir')}>
            {RIR_OPTIONS.map((r) => (
              <button
                key={r}
                aria-pressed={rir === r}
                className={rir === r && !rirTouched ? 'suggested' : undefined}
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
      )}
      <button
        className="btn btn-primary btn-lg btn-block logger-submit"
        disabled={busy}
        onClick={async () => {
          if (busy) return
          setBusy(true)
          try {
            await onSubmit({
              kind: defaults.kind,
              weightKg: captions.weight === null ? 0 : weight,
              reps,
              rir: warm ? null : rir,
              rirSource: warm ? undefined : rirTouched ? 'user' : 'default',
            })
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
