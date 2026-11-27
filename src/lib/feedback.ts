/**
 * Sound, vibration and screen wake lock. All are best effort and
 * feature-detected: iOS Safari has no Vibration API, and audio needs a
 * user gesture before it can play (unlockAudio is called on taps).
 */

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    return ctx
  } catch {
    return null
  }
}

/**
 * Starts or revives the audio context. Must run inside a user gesture on iOS.
 * iOS also leaves the context "interrupted" (not only "suspended") after the
 * app was in the background or a call came in, so resume on any non-running
 * state. Creating the context lazily here keeps the first tap as the unlock.
 */
export function unlockAudio(): void {
  const a = audio()
  if (a && a.state !== 'running') void a.resume().catch(() => {})
}

/** Two short soft tones. */
export function playRestEndSound(): void {
  const a = audio()
  if (!a) return
  try {
    // Outside a gesture this may be refused on iOS; the tones are then lost,
    // which is why the screen always shows the finished state as well.
    if (a.state !== 'running') void a.resume().catch(() => {})
    const start = a.currentTime + 0.05
    ;[0, 0.22].forEach((offset, i) => {
      const osc = a.createOscillator()
      const gain = a.createGain()
      osc.type = 'sine'
      osc.frequency.value = i === 0 ? 880 : 1175
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18)
      osc.connect(gain).connect(a.destination)
      osc.start(start + offset)
      osc.stop(start + offset + 0.2)
    })
  } catch {
    // ignore: sound is optional
  }
}

export function vibrate(pattern: number | number[]): boolean {
  try {
    if (typeof navigator.vibrate === 'function') return navigator.vibrate(pattern)
  } catch {
    // ignore
  }
  return false
}

export const supportsVibration = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

let wakeLock: WakeLockSentinel | null = null

export async function acquireWakeLock(): Promise<boolean> {
  try {
    if (!('wakeLock' in navigator)) return false
    if (wakeLock && !wakeLock.released) return true
    wakeLock = await navigator.wakeLock.request('screen')
    return true
  } catch {
    return false
  }
}

export async function releaseWakeLock(): Promise<void> {
  try {
    await wakeLock?.release()
  } catch {
    // ignore
  }
  wakeLock = null
}

/** Current audio context state ("running", "suspended", "interrupted"), or null if never created. */
export function audioState(): string | null {
  return ctx?.state ?? null
}
