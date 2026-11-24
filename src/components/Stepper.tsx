import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { formatNumber, parseDecimal, t } from '../i18n'

interface StepperProps {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
  label: string
  size?: 'md' | 'lg'
  /** Allows typing a value (decimal keypad) by tapping the number. */
  editable?: boolean
  format?: (v: number) => string
}

function roundTo(v: number, step: number) {
  const decimals = (String(step).split('.')[1] ?? '').length
  return Number(v.toFixed(Math.max(decimals, 2)))
}

/** Plus/minus control with large targets; typing is optional. */
export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, unit, label, size = 'md', editable = false, format }: StepperProps) {
  const [text, setText] = useState(formatNumber(value))
  const [focused, setFocused] = useState(false)

  const clamp = (v: number) => Math.min(max, Math.max(min, roundTo(v, step)))
  const shown = format ? format(value) : formatNumber(value)

  return (
    <div className={`stepper ${size === 'lg' ? 'lg' : ''}`} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(clamp(value - step))} aria-label={`${t('common.decrease')} ${label}`} disabled={value <= min}>
        <Minus size={size === 'lg' ? 24 : 18} />
      </button>
      {editable ? (
        <input
          className="value num"
          inputMode="decimal"
          enterKeyHint="done"
          aria-label={label}
          value={focused ? text : shown}
          onFocus={(e) => {
            setFocused(true)
            setText(formatNumber(value))
            requestAnimationFrame(() => e.target.select())
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            setFocused(false)
            const parsed = parseDecimal(text)
            if (parsed !== null) onChange(Math.min(max, Math.max(min, parsed)))
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <span className="value num" aria-live="polite">
          {shown}
          {unit && <span className="unit">{unit}</span>}
        </span>
      )}
      <button type="button" onClick={() => onChange(clamp(value + step))} aria-label={`${t('common.increase')} ${label}`} disabled={value >= max}>
        <Plus size={size === 'lg' ? 24 : 18} />
      </button>
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />
}
