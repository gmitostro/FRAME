import type { RestTimerState } from './types'

/**
 * Rest timer maths. State holds only timestamps, never a ticking counter,
 * so the remaining time is correct after the app was backgrounded, the
 * screen was locked or the page was reloaded.
 */

export function startTimer(now: number, durationSec: number, exerciseRef: string, setId: string): RestTimerState {
  const durationMs = Math.max(0, Math.round(durationSec * 1000))
  return {
    startedAt: now,
    durationMs,
    baseDurationMs: durationMs,
    pausedAt: null,
    pausedMs: 0,
    exerciseRef,
    setId,
    alerted: false,
  }
}

/** Active (non-paused) time since the timer started. */
export function elapsedMs(t: RestTimerState, now: number): number {
  const end = t.pausedAt ?? now
  return Math.max(0, end - t.startedAt - t.pausedMs)
}

/** Remaining time; negative once the rest is over (overrun). */
export function remainingMs(t: RestTimerState, now: number): number {
  return t.durationMs - elapsedMs(t, now)
}

export function isFinished(t: RestTimerState, now: number): boolean {
  return remainingMs(t, now) <= 0
}

export function isPaused(t: RestTimerState): boolean {
  return t.pausedAt !== null
}

export function pauseTimer(t: RestTimerState, now: number): RestTimerState {
  if (t.pausedAt !== null) return t
  return { ...t, pausedAt: now }
}

export function resumeTimer(t: RestTimerState, now: number): RestTimerState {
  if (t.pausedAt === null) return t
  return { ...t, pausedMs: t.pausedMs + Math.max(0, now - t.pausedAt), pausedAt: null }
}

/**
 * "Reiniciar": removes every manual extension (+15/+30 s) from the current
 * rest. Extensions only ever change durationMs, so restoring the prescribed
 * duration undoes them while startedAt, pausedAt and pausedMs keep the time
 * already elapsed and the pause state exactly as they were.
 * Sessions saved before baseDurationMs existed have no record of the
 * original duration and are left unchanged.
 */
export function restartTimer(t: RestTimerState, now: number): RestTimerState {
  const next = { ...t, durationMs: t.baseDurationMs ?? t.durationMs }
  // Rest still running: the end alert is due again. Rest already over without
  // the extensions: treat it as alerted so no late beep plays.
  return { ...next, alerted: remainingMs(next, now) <= 0 }
}

/** Adds time to the rest. Works also after the countdown reached zero. */
export function extendTimer(t: RestTimerState, now: number, addSec: number): RestTimerState {
  const remaining = remainingMs(t, now)
  // If already overrun, extend from "now" rather than from the original end.
  const base = remaining < 0 ? t.durationMs - remaining : t.durationMs
  return { ...t, durationMs: base + addSec * 1000, alerted: false }
}

/** Progress from 0 (just started) to 1 (finished). */
export function progress(t: RestTimerState, now: number): number {
  if (t.durationMs <= 0) return 1
  return Math.min(1, Math.max(0, elapsedMs(t, now) / t.durationMs))
}
