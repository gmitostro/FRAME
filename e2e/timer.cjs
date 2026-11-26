/* Rest timer reliability e2e (Chromium, iPhone 13 viewport, controlled clock).
 * Sound and wake lock are instrumented: the test counts alert attempts and
 * lock requests/releases. It cannot prove a sound was heard on a phone.
 * Usage: npm run build && node e2e/timer.cjs
 */
const { chromium, devices } = require('playwright')
const { spawn } = require('child_process')
const path = require('path')

const PORT = 4178
const BASE = `http://localhost:${PORT}/`

const log = (m) => console.log(`  ✓ ${m}`)
function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`)
}
async function until(fn, msg, timeout = 4000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const v = await fn()
    if (v) return v
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`Timed out waiting: ${msg}`)
}

async function startServer() {
  try {
    if ((await fetch(BASE)).ok) return null
  } catch {}
  const vite = path.join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js')
  const proc = spawn(process.execPath, [vite, 'preview', '--port', String(PORT), '--strictPort'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' })
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE)).ok) return proc
    } catch {}
    await new Promise((r) => setTimeout(r, 200))
  }
  proc.kill()
  throw new Error('preview server did not start')
}

;(async () => {
  const server = await startServer()
  const browser = await chromium.launch()
  const { defaultBrowserType: _d, ...iphone } = devices['iPhone 13']
  const context = await browser.newContext({ ...iphone, deviceScaleFactor: 1, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
  await context.addInitScript(() => {
    // Count rest-end tones (2 oscillators per alert) and wake lock usage.
    window.__osc = 0
    const C = window.AudioContext
    if (C) {
      const orig = C.prototype.createOscillator
      C.prototype.createOscillator = function () {
        window.__osc++
        return orig.call(this)
      }
    }
    window.__wl = { requested: 0, released: 0 }
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () => {
          window.__wl.requested++
          const s = { released: false, async release() { if (!s.released) { s.released = true; window.__wl.released++ } }, addEventListener() {} }
          return s
        },
      },
    })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.clock.install({ time: new Date('2026-11-24T18:30:00-03:00') })

  const alerts = async () => (await page.evaluate(() => window.__osc)) / 2
  const wl = () => page.evaluate(() => window.__wl)
  const dockTime = () => page.locator('.timer-time').innerText()
  const dockLabel = () => page.locator('.timer-label').innerText()
  const toSec = (s) => {
    const m = s.replace('+', '').trim().split(':').map(Number)
    return m.length === 3 ? m[0] * 3600 + m[1] * 60 + m[2] : m[0] * 60 + m[1]
  }
  /** Rest timer as stored in IndexedDB (the source of truth), not the screen. */
  const storedTimer = () =>
    page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open('frame')
          req.onerror = () => reject(req.error)
          req.onsuccess = () => {
            const db = req.result
            const q = db.transaction('sessions').objectStore('sessions').getAll()
            q.onerror = () => reject(q.error)
            q.onsuccess = () => {
              db.close()
              resolve(q.result.find((x) => x.status === 'active')?.restTimer ?? null)
            }
          }
        }),
    )
  async function logSet() {
    const before = await page.locator('.set-row.done').count()
    await page.locator('.logger-submit').click()
    await until(async () => (await page.locator('.set-row.done').count()) === before + 1, 'set saved')
  }

  try {
    // Workout with one isolation exercise (rest 2:00, no warm-ups).
    await page.goto(BASE)
    await page.getByRole('link', { name: 'Treinos', exact: true }).click()
    await page.getByRole('button', { name: 'Novo treino' }).click()
    await page.getByRole('button', { name: 'Adicionar exercício' }).click()
    await page.getByPlaceholder('Buscar exercício').fill('rosca direta barra')
    await page.locator('.sheet .list-row', { hasText: 'Rosca direta com barra' }).first().click()
    await page.locator('article', { hasText: 'Rosca direta com barra' }).waitFor()
    await page.getByRole('button', { name: 'Voltar' }).click()
    await page.locator('article', { has: page.locator('.card-title', { hasText: /^Novo treino$/ }) }).getByRole('button', { name: 'Iniciar' }).click()
    await page.locator('.logger-submit').waitFor()
    await until(async () => (await wl()).requested >= 1, 'wake lock requested')

    // 1. Alert fires while another tab is open
    await logSet()
    assert((await dockTime()) === '2:00', `timer starts at 2:00 (${await dockTime()})`)
    await page.locator('.wk-top').getByRole('link', { name: 'Voltar' }).click()
    await page.getByText('Treino em andamento').first().waitFor()
    assert((await wl()).released === 0, 'wake lock kept when leaving the workout screen')
    log('wake lock kept on other tabs')
    await page.clock.fastForward(121_000)
    await until(async () => (await alerts()) === 1, 'alert on another tab')
    const banner = await page.locator('.live-banner').innerText()
    assert(/Concluído \+0:0\d/.test(banner), `banner shows overrun: ${banner}`)
    log(`rest-end alert fired on the Home tab; banner "${banner.split('\n').pop()}"`)

    // Back to the workout: no second alert, overrun shown
    await page.locator('.live-banner a').click()
    await page.locator('.timer-dock').waitFor()
    assert((await dockLabel()) === 'CONCLUÍDO' || (await dockLabel()).toLowerCase() === 'concluído', `dock label ${await dockLabel()}`)
    await page.clock.fastForward(5000)
    assert((await alerts()) === 1, 'no repeated alert after returning')
    log(`overrun shown on return (${await dockTime()}), no repeated alert`)

    // 2. +30 s after overrun counts from now
    await page.getByRole('button', { name: '+30 s' }).click()
    await until(async () => toSec(await dockTime()) >= 29 && !(await dockTime()).startsWith('+'), '+30 s from now')
    await page.clock.fastForward(31_000)
    await until(async () => (await alerts()) === 2, 'alert after +30 s')
    log('+30 s after overrun restarts from now and alerts again')

    // 3. Real-use repro: 2:00 → 20 s → 1:40 → +30 → 2:10 → +15 → 2:25 → Reiniciar → 1:40
    await logSet() // second working set: a new 2:00 rest
    await until(async () => (await dockTime()) === '2:00', 'new rest at 2:00')
    const before3 = await storedTimer()
    await page.clock.fastForward(20_000)
    await until(async () => (await dockTime()) === '1:40', `1:40 after 20 s (saw ${await dockTime()})`)
    await page.getByRole('button', { name: '+30 s' }).click()
    await until(async () => (await dockTime()) === '2:10', `+30 s → 2:10 (saw ${await dockTime()})`)
    await page.getByRole('button', { name: '+15 s' }).click()
    await until(async () => (await dockTime()) === '2:25', `+15 s → 2:25 (saw ${await dockTime()})`)
    await page.getByRole('button', { name: 'Reiniciar descanso' }).click()
    await until(async () => (await dockTime()) === '1:40', `Reiniciar → 1:40 (saw ${await dockTime()})`)
    const after3 = await storedTimer()
    assert(after3.durationMs === 120_000 && after3.startedAt === before3.startedAt && after3.pausedMs === before3.pausedMs && after3.pausedAt === null,
      `stored state keeps elapsed time: ${JSON.stringify({ before3, after3 })}`)
    log('Reiniciar removes +30/+15 s and keeps the 20 s elapsed: 2:25 → 1:40 (screen and stored state)')

    // pause holds the time, resume continues from it
    await page.getByRole('button', { name: 'Pausar descanso' }).click()
    await page.getByRole('button', { name: 'Continuar descanso' }).waitFor()
    const held3 = await dockTime() // real time keeps flowing between clicks
    assert(toSec(held3) >= 98 && toSec(held3) <= 100, `paused near 1:40 (${held3})`)
    await page.clock.fastForward(300_000)
    assert((await dockTime()) === held3, `paused timer holds (${held3} → ${await dockTime()})`)
    assert((await alerts()) === 2, 'no alert while paused')
    await page.getByRole('button', { name: 'Reiniciar descanso' }).click()
    await page.waitForTimeout(300)
    assert((await dockTime()) === held3 && (await dockLabel()).toLowerCase() === 'pausado', `Reiniciar while paused keeps it paused at ${held3} (${await dockLabel()} ${await dockTime()})`)
    await page.getByRole('button', { name: 'Continuar descanso' }).click()
    await page.getByRole('button', { name: 'Pausar descanso' }).waitFor() // saved before time moves
    await page.clock.fastForward(60_000)
    await until(async () => Math.abs(toSec(await dockTime()) - (toSec(held3) - 60)) <= 2, `resumed countdown from ${held3} (saw ${await dockTime()} ${await dockLabel()})`)
    log(`5 min paused without change, Reiniciar while paused stays paused, resumed (${await dockTime()})`)

    // 4. Workout pause does not override a manual timer pause
    await page.getByRole('button', { name: 'Pausar descanso' }).click()
    await page.getByRole('button', { name: 'Continuar descanso' }).waitFor()
    const held = await dockTime()
    await page.locator('.wk-top').getByRole('button', { name: 'Pausar' }).click()
    await page.getByText('Treino pausado').first().waitFor()
    await page.clock.fastForward(60_000)
    await page.locator('.notice').getByRole('button', { name: 'Continuar' }).click()
    await until(async () => (await page.getByText('Treino pausado').count()) === 0, 'workout resumed')
    await page.clock.fastForward(10_000)
    assert((await dockLabel()).toLowerCase() === 'pausado' && (await dockTime()) === held, `manual pause kept after workout resume (${await dockLabel()} ${await dockTime()})`)
    log('timer paused by the user stays paused when the workout resumes')

    // 5. Simulated background: JS does not run for 10 min, then returns
    await page.getByRole('button', { name: 'Continuar descanso' }).click()
    await page.getByRole('button', { name: 'Pausar descanso' }).waitFor()
    const before = await alerts()
    await page.clock.fastForward(600_000) // jump: like a locked phone
    await until(async () => (await dockTime()).startsWith('+'), 'overrun after jump')
    const over = toSec(await dockTime())
    assert(over >= 9 * 60 - 5 && over <= 10 * 60, `overrun computed from timestamps (${await dockTime()})`)
    await page.waitForTimeout(500)
    assert((await alerts()) === before, 'no late alert after a long suspension')
    log(`10 min jump: overrun ${await dockTime()} from timestamps, no late beep`)

    // 6. Reload during rest keeps the countdown
    await page.getByRole('button', { name: 'Série extra' }).click()
    await logSet()
    await page.clock.fastForward(30_000)
    await page.reload()
    await page.locator('.timer-dock').waitFor()
    const afterReload = toSec(await dockTime())
    assert(afterReload <= 90 && afterReload >= 88, `reload keeps remaining time (${await dockTime()})`)
    log(`reload during rest: ${await dockTime()} remaining`)

    // 7. Finishing releases the wake lock
    await page.locator('.wk-top').getByRole('button', { name: 'Finalizar treino' }).click()
    await page.locator('.sheet').getByRole('button', { name: 'Finalizar treino' }).click()
    await page.locator('.sheet').last().getByRole('button', { name: 'Finalizar treino' }).click()
    await page.getByText('Treino concluído').waitFor()
    await until(async () => (await wl()).released >= 1, 'wake lock released after finishing')
    log('wake lock released when the workout ends')

    assert(errors.length === 0, `console errors: ${errors.join(' | ')}`)
    log('no console errors')
    console.log('\nTIMER E2E PASSED')
  } catch (err) {
    console.error('\nTIMER E2E FAILED:', err.message)
    if (errors.length) console.error('console errors:', errors)
    process.exitCode = 1
  } finally {
    await browser.close()
    server?.kill()
  }
})()
