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

  it('progress is elapsed over duration', () => {
    const t = T.startTimer(t0, 60, 'ex', 'set')
    expect(T.progress(t, t0 + 30_000)).toBeCloseTo(0.5)
  })
})

/** "Reiniciar" removes manual extensions only; elapsed time stays elapsed. */
describe('rest timer: Reiniciar', () => {
  const s = (sec: number) => sec * 1000

  it('A: +30 s then Reiniciar returns to the remaining time before the extension', () => {
    let t = T.startTimer(t0, 120, 'ex', 'set')
    expect(T.remainingMs(t, t0 + s(20))).toBe(s(100))
    t = T.extendTimer(t, t0 + s(20), 30)
    expect(T.remainingMs(t, t0 + s(20))).toBe(s(130))
    t = T.restartTimer(t, t0 + s(20))
    expect(T.remainingMs(t, t0 + s(20))).toBe(s(100))
    // state, not only the display: elapsed and start are untouched
    expect(t.startedAt).toBe(t0)
    expect(t.pausedMs).toBe(0)
    expect(t.durationMs).toBe(s(120))
    expect(T.elapsedMs(t, t0 + s(20))).toBe(s(20))
  })

  it('B: +15 s then Reiniciar', () => {
    let t = T.startTimer(t0, 120, 'ex', 'set')
    t = T.extendTimer(t, t0 + s(20), 15)
    expect(T.remainingMs(t, t0 + s(20))).toBe(s(115))
    t = T.restartTimer(t, t0 + s(20))
    expect(T.remainingMs(t, t0 + s(20))).toBe(s(100))
  })

  it('C: accumulated +30 s and +15 s are both removed', () => {
    let t = T.startTimer(t0, 120, 'ex', 'set')
    t = T.extendTimer(t, t0 + s(20), 30)
    t = T.extendTimer(t, t0 + s(20), 15)
    expect(T.remainingMs(t, t0 + s(20))).toBe(s(145))
    t = T.restartTimer(t, t0 + s(20))
    expect(T.remainingMs(t, t0 + s(20))).toBe(s(100))
  })

  it('C2: extensions at different moments; time between them stays elapsed', () => {
    let t = T.startTimer(t0, 120, 'ex', 'set')
    t = T.extendTimer(t, t0 + s(20), 30) // 130 left
    t = T.extendTimer(t, t0 + s(50), 15) // 100 + 15 = 115 left
    t = T.restartTimer(t, t0 + s(60))
    expect(T.remainingMs(t, t0 + s(60))).toBe(s(60)) // 120 - 60 elapsed
  })

  it('D: Reiniciar without extensions changes nothing and recovers no time', () => {
    const t = T.startTimer(t0, 120, 'ex', 'set')
    const r = T.restartTimer(t, t0 + s(45))
    expect(T.remainingMs(r, t0 + s(45))).toBe(s(75))
    expect(r).toEqual(t) // identical state (alerted stays false while time remains)
  })

  it('D2: after the rest is over, Reiniciar keeps the overrun and does not re-arm the alert', () => {
    let t = T.startTimer(t0, 120, 'ex', 'set')
    t = { ...t, alerted: true } // end alert already played at 120 s
    t = T.extendTimer(t, t0 + s(125), 30) // overrun 5 s, +30 from now
    expect(t.alerted).toBe(false)
    t = T.restartTimer(t, t0 + s(130))
    expect(T.remainingMs(t, t0 + s(130))).toBe(s(-10))
    expect(t.alerted).toBe(true)
  })

  it('D3: removing extensions with time left re-arms the end alert', () => {
    let t = T.startTimer(t0, 120, 'ex', 'set')
    t = T.extendTimer(t, t0 + s(20), 30)
    t = T.restartTimer(t, t0 + s(20))
    expect(t.alerted).toBe(false)
  })

  it('E (timer level): Reiniciar while paused keeps it paused with the correct time', () => {
    let t = T.startTimer(t0, 120, 'ex', 'set')
    t = T.pauseTimer(t, t0 + s(20))
    t = T.extendTimer(t, t0 + s(40), 30)
    expect(T.remainingMs(t, t0 + s(40))).toBe(s(130))
    t = T.restartTimer(t, t0 + s(50))
    expect(T.isPaused(t)).toBe(true)
    expect(t.pausedAt).toBe(t0 + s(20))
    expect(T.remainingMs(t, t0 + s(500))).toBe(s(100)) // frozen while paused
    t = T.resumeTimer(t, t0 + s(500))
    expect(T.remainingMs(t, t0 + s(510))).toBe(s(90))
  })

  it('legacy timers without baseDurationMs are left unchanged', () => {
    let t = T.startTimer(t0, 120, 'ex', 'set')
    delete t.baseDurationMs
    t = T.extendTimer(t, t0 + s(20), 30)
    const r = T.restartTimer(t, t0 + s(20))
    expect(T.remainingMs(r, t0 + s(20))).toBe(s(130))
  })
})
