/* Live-workout layout on four iPhone sizes (Chromium emulation) plus the
 * post-workout summary. Checks that the "Concluir" button is reachable
 * without scrolling where the screen allows it, that automatic scrolling
 * happens only when the timer/footer would cover the button, and that the
 * exercise name stays visible on screens tall enough for it.
 * Usage: npm run build && node e2e/layout.cjs
 */
const { chromium } = require('playwright')
const { spawn } = require('child_process')
const path = require('path')

const PORT = 4179
const BASE = `http://localhost:${PORT}/`
const SIZES = [
  ['iPhone SE', 375, 667],
  ['iPhone 13 mini', 375, 812],
  ['iPhone 13', 390, 844],
  ['iPhone Pro Max', 430, 932],
]
const log = (m) => console.log(`  ✓ ${m}`)
function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`)
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

async function measure(page) {
  return page.evaluate(() => {
    const r = (sel) => document.querySelector(sel)?.getBoundingClientRect() ?? null
    const top = Math.max(0, ...[...document.querySelectorAll('[data-overlay-top]')].map((e) => e.getBoundingClientRect().bottom))
    const bottom = Math.min(window.innerHeight, ...[...document.querySelectorAll('[data-overlay-bottom]')].map((e) => e.getBoundingClientRect().top))
    const btn = r('.logger-submit') ?? r('.exercise-done .btn-primary')
    const name = r('.wk-name')
    return {
      scrollY: Math.round(window.scrollY),
      buttonVisible: !!btn && btn.top >= top && btn.bottom <= bottom,
      nameVisible: !!name && name.top >= top - 2 && name.bottom <= bottom,
    }
  })
}

async function logAndWait(page) {
  const before = await page.locator('.set-row.done').count()
  await page.locator('.logger-submit').click()
  await page.waitForFunction((b) => document.querySelectorAll('.set-row.done').length > b, before)
  await page.waitForTimeout(600) // let any smooth scroll settle
}

async function finish(page) {
  await page.locator('.wk-top').getByRole('button', { name: 'Finalizar treino' }).click()
  await page.locator('.sheet').getByRole('button', { name: 'Finalizar treino' }).click()
  await page.locator('.sheet').last().getByRole('button', { name: 'Finalizar treino' }).click()
  await page.getByText('Treino concluído').waitFor()
}

;(async () => {
  const server = await startServer()
  const browser = await chromium.launch()
  const errors = []
  try {
    for (const [label, w, h] of SIZES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
      const page = await ctx.newPage()
      page.setDefaultTimeout(10000)
      page.on('pageerror', (e) => errors.push(String(e)))
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
      await page.clock.install({ time: new Date('2026-11-24T18:30:00-03:00') })
      await page.goto(BASE)

      // Session 1: first exercise of Full Body A at the top of the range (2 warm-ups + 3 × 8 @ 30 kg, RIR 2)
      await page.getByRole('button', { name: 'Iniciar treino' }).click()
      await page.locator('.logger-submit').waitFor()
      for (let i = 0; i < 2; i++) await logAndWait(page)
      for (let i = 0; i < 3; i++) {
        const weight = page.locator('.logger input[aria-label="Carga"]')
        await weight.fill('30')
        await weight.blur()
        const reps = page.locator('.logger [aria-label="Reps"] .value')
        while (Number(await reps.innerText()) < 8) await page.getByRole('button', { name: 'Aumentar Reps' }).click()
        await logAndWait(page)
      }
      await finish(page)
      await page.getByRole('link', { name: 'Ir para o início' }).click()

      // Session 2: suggestion + note + warm-ups (the tallest case)
      await page.clock.fastForward(24 * 3600 * 1000 * 7) // a week later, same weekday
      await page.reload()
      await page.getByRole('button', { name: 'Iniciar treino' }).click()
      await page.locator('.suggest.up').waitFor()
      await page.waitForTimeout(400)
      const initial = await measure(page)
      for (let i = 0; i < 2; i++) await logAndWait(page)
      const afterWarmups = await measure(page)
      await logAndWait(page) // first working set: timer appears
      await page.locator('.timer-dock').waitFor()
      await page.waitForTimeout(400)
      const withTimer = await measure(page)

      assert(initial.buttonVisible && initial.nameVisible && initial.scrollY === 0, `${label}: initial ${JSON.stringify(initial)}`)
      assert(afterWarmups.buttonVisible, `${label}: after warm-ups ${JSON.stringify(afterWarmups)}`)
      assert(withTimer.buttonVisible, `${label}: with timer ${JSON.stringify(withTimer)}`)
      if (h >= 800) {
        assert(afterWarmups.scrollY === 0 && withTimer.scrollY === 0 && withTimer.nameVisible, `${label}: no automatic scroll needed ${JSON.stringify({ afterWarmups, withTimer })}`)
      }
      log(`${label} ${w}×${h}: button visible at start, after warm-ups and with timer; auto-scroll ${afterWarmups.scrollY}/${withTimer.scrollY}px`)

      // Changing exercise opens the next one at the top
      await page.evaluate(() => window.scrollTo(0, 400))
      await page.locator('.wk-footer').getByRole('button', { name: 'Próximo' }).click()
      await page.locator('.wk-name', { hasText: 'Agachamento hack' }).waitFor()
      await page.waitForTimeout(300)
      assert((await measure(page)).scrollY === 0, `${label}: next exercise opens at the top`)

      if (label === 'iPhone 13') {
        // Summary: records of the day, estimate and skipped exercises
        await page.locator('.wk-footer').getByRole('button', { name: 'Anterior' }).click()
        await page.locator('.wk-name', { hasText: 'Supino inclinado' }).waitFor()
        await finish(page)
        const summary = await page.locator('body').innerText()
        assert(/recordes de hoje/i.test(summary) && /Supino inclinado com halteres/.test(summary) && summary.includes('32 kg × 6') && summary.includes('antes 30 kg × 8'), `summary record: ${summary}`)
        assert(/Estimativa deste treino: ~\d+ min/.test(summary), 'summary shows the estimate')
        assert(summary.includes('5 exercícios pulados'), 'summary shows skipped exercises')
        log('summary shows the record (32 kg × 6, before 30 kg × 8), estimate and skipped exercises')
      }
      await ctx.close()
    }
    assert(errors.length === 0, `console errors: ${errors.join(' | ')}`)
    log('no console errors')
    console.log('\nLAYOUT E2E PASSED')
  } catch (err) {
    console.error('\nLAYOUT E2E FAILED:', err.message)
    if (errors.length) console.error('console errors:', errors)
    process.exitCode = 1
  } finally {
    await browser.close()
    server?.kill()
  }
})()
