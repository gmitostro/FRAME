import { useEffect } from 'react'
import { mutateSession } from '../data/repo'
import { applyTimerAction } from '../domain/session'
import * as T from '../domain/timer'
import { acquireWakeLock, playRestEndSound, releaseWakeLock, unlockAudio, vibrate } from '../lib/feedback'
import { useActiveSession, useSettings } from './hooks'

/**
 * App-level side effects of an active workout, independent of the screen
 * being shown (workout, home, history...):
 * - rest-end alert: scheduled for the exact end time from timestamps;
 * - screen wake lock while a workout is active;
 * - audio unlock on any tap (iOS needs a gesture to start or revive audio).
 *
 * Browsers suspend JavaScript in the background (always on iOS). An alert
 * whose end was missed by more than ALERT_WINDOW_MS is not played late: the
 * screen shows the overrun instead. No background alert is attempted.
 */
export const ALERT_WINDOW_MS = 5000

export function RestWatcher() {
  const session = useActiveSession()
  const settings = useSettings()
  const timer = session?.restTimer ?? null
  const sessionId = session?.id ?? null

  // Audio must be (re)started from a user gesture on iOS; any tap will do.
  useEffect(() => {
    const onTap = () => unlockAudio()
    window.addEventListener('pointerdown', onTap, { passive: true })
    return () => window.removeEventListener('pointerdown', onTap)
  }, [])

  // Keep the screen on for the whole workout, not only on the workout screen.
  const keepOn = !!sessionId && !!settings?.keepScreenOn
  useEffect(() => {
    if (!keepOn) return
    void acquireWakeLock()
    // The browser releases the lock whenever the page is hidden.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquireWakeLock()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void releaseWakeLock()
    }
  }, [keepOn])

  // Rest-end alert.
  const sound = settings?.soundEnabled ?? false
  const haptics = settings?.hapticsEnabled ?? false
  useEffect(() => {
    if (!sessionId || !timer || timer.alerted || timer.pausedAt !== null) return
    let handle: number | undefined
    let done = false

    const fire = () => {
      if (done) return
      const remaining = T.remainingMs(timer, Date.now())
      if (remaining > 0) {
        schedule()
        return
      }
      done = true
      if (-remaining <= ALERT_WINDOW_MS) {
        if (sound) playRestEndSound()
        if (haptics) vibrate([120, 80, 120])
      }
      // Mark only this timer instance; a newer one must keep its own alert.
      void mutateSession(sessionId, (s, now) =>
        s.restTimer && s.restTimer.setId === timer.setId && s.restTimer.startedAt === timer.startedAt && !s.restTimer.alerted
          ? applyTimerAction(s, { type: 'markAlerted' }, now)
          : s,
      ).catch((err) => console.error('[FRAME] markAlerted failed', err))
    }
    const schedule = () => {
      window.clearTimeout(handle)
      handle = window.setTimeout(fire, Math.max(0, T.remainingMs(timer, Date.now())))
    }
    // Timers do not run while the app is suspended: re-check on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible') fire()
    }

    schedule()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      done = true
      window.clearTimeout(handle)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [sessionId, timer, sound, haptics])

  return null
}
