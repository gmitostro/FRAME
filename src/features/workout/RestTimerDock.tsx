import { Pause, Play, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useNow } from '../../app/hooks'
import * as T from '../../domain/timer'
import type { RestTimerState, Settings } from '../../domain/types'
import { playRestEndSound, vibrate } from '../../lib/feedback'
import { formatClock, t } from '../../i18n'

interface Props {
  timer: RestTimerState
  settings: Settings
  onAction: (a: { type: 'pause' } | { type: 'resume' } | { type: 'restart' } | { type: 'extend'; sec: number } | { type: 'dismiss' } | { type: 'markAlerted' }) => void
}

/** Alerts only if the end was seen live (within this window). */
const LIVE_ALERT_WINDOW_MS = 5000

export function RestTimerDock({ timer, settings, onAction }: Props) {
  const now = useNow(250)
  const remaining = T.remainingMs(timer, now)
  const paused = T.isPaused(timer)
  const done = remaining <= 0
  const pct = T.progress(timer, now)
  const alertedRef = useRef(timer.alerted)

  useEffect(() => {
    alertedRef.current = timer.alerted
  }, [timer.alerted])

  useEffect(() => {
    if (!done || paused || alertedRef.current) return
    alertedRef.current = true
    const overdue = -remaining
    if (overdue < LIVE_ALERT_WINDOW_MS && document.visibilityState === 'visible') {
      if (settings.soundEnabled) playRestEndSound()
      if (settings.hapticsEnabled) vibrate([120, 80, 120])
    }
    onAction({ type: 'markAlerted' })
  }, [done, paused, remaining, settings.soundEnabled, settings.hapticsEnabled, onAction])

  const cls = ['timer-card', done ? 'done' : '', paused ? 'paused' : ''].join(' ')
  return (
    <div className="timer-dock" role="timer" aria-live="off">
      <div className={cls}>
        <div className="timer-bar">
          <span style={{ width: `${pct * 100}%` }} />
        </div>
        <div className="timer-main">
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="timer-label">{paused ? t('timer.paused') : done ? t('timer.restDoneShort') : t('timer.rest')}</div>
            <div className="timer-time" aria-label={t('timer.rest')}>
              {done ? t('timer.overrun', { time: formatClock(-remaining) }) : formatClock(remaining)}
            </div>
          </div>
        <div className="timer-actions">
          <button className="btn" onClick={() => onAction({ type: paused ? 'resume' : 'pause' })} aria-label={paused ? t('timer.resume') : t('timer.pause')}>
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button className="btn" onClick={() => onAction({ type: 'restart' })} aria-label={t('timer.restart')}>
            <RotateCcw size={18} />
          </button>
          <button className="btn num" onClick={() => onAction({ type: 'extend', sec: 15 })}>
            {t('timer.add15')}
          </button>
          <button className="btn num" onClick={() => onAction({ type: 'extend', sec: 30 })}>
            {t('timer.add30')}
          </button>
          <button className="btn" onClick={() => onAction({ type: 'dismiss' })} aria-label={t('timer.dismiss')}>
            <X size={18} />
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}
