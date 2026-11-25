import { Pause, Play, RotateCcw, X } from 'lucide-react'
import { useNow } from '../../app/hooks'
import type { TimerAction } from '../../domain/session'
import * as T from '../../domain/timer'
import type { RestTimerState } from '../../domain/types'
import { formatClock, t } from '../../i18n'

interface Props {
  timer: RestTimerState
  onAction: (a: Exclude<TimerAction, { type: 'markAlerted' }>) => void
}

/**
 * Display and controls only. The end-of-rest alert lives in RestWatcher so
 * it also fires when another tab is open. Time is always recomputed from the
 * stored timestamps; the 250 ms tick only refreshes the digits.
 */
export function RestTimerDock({ timer, onAction }: Props) {
  const now = useNow(250)
  const remaining = T.remainingMs(timer, now)
  const paused = T.isPaused(timer)
  const done = remaining <= 0
  const pct = T.progress(timer, now)

  const cls = ['timer-card', done ? 'done' : '', paused ? 'paused' : ''].join(' ')
  return (
    <div className="timer-dock" role="timer" aria-live="off">
      <div className={cls} data-overlay-bottom>
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
