import { describe, expect, it } from 'vitest'
import * as T from '../src/domain/timer'

const t0 = 1_000_000

describe('rest timer', () => {
  it('computes remaining time from timestamps', () => {
    const t = T.startTimer(t0, 180, 'ex', 'set')
    expect(T.remainingMs(t, t0)).toBe(180_000)
    expect(T.remainingMs(t, t0 + 60_000)).toBe(120_000)
  })

  it('stays correct after a long gap (app in background)', () => {
    const t = T.startTimer(t0, 120, 'ex', 'set')
    // 5 minutes later, no ticks in between
    expect(T.remainingMs(t, t0 + 300_000)).toBe(-180_000)
    expect(T.isFinished(t, t0 + 300_000)).toBe(true)
  })

  it('freezes while paused and resumes', () => {
    let t = T.startTimer(t0, 90, 'ex', 'set')
    t = T.pauseTimer(t, t0 + 30_000)
    expect(T.remainingMs(t, t0 + 90_000)).toBe(60_000)
    t = T.resumeTimer(t, t0 + 90_000)
    expect(T.remainingMs(t, t0 + 100_000)).toBe(50_000)
  })

  it('pausing twice does not lose time', () => {
    let t = T.startTimer(t0, 90, 'ex', 'set')
    t = T.pauseTimer(t, t0 + 10_000)
    t = T.pauseTimer(t, t0 + 20_000)
    t = T.resumeTimer(t, t0 + 30_000)
    expect(T.remainingMs(t, t0 + 30_000)).toBe(80_000)
  })

  it('extends by +15/+30 s, also after overrun', () => {
    let t = T.startTimer(t0, 60, 'ex', 'set')
    t = T.extendTimer(t, t0 + 10_000, 30)
    expect(T.remainingMs(t, t0 + 10_000)).toBe(80_000)
    const over = T.startTimer(t0, 60, 'ex', 'set')
    const ext = T.extendTimer(over, t0 + 70_000, 15) // 10 s overrun
    expect(T.remainingMs(ext, t0 + 70_000)).toBe(15_000)
  })

  it('restarts from now', () => {
    let t = T.startTimer(t0, 60, 'ex', 'set')
    t = T.restartTimer(t, t0 + 50_000)
    expect(T.remainingMs(t, t0 + 50_000)).toBe(60_000)
    expect(T.progress(t, t0 + 80_000)).toBeCloseTo(0.5)
  })
})
