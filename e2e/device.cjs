/* Device check screen e2e (Chromium, iPhone 13 viewport, controlled clock).
 * Web Audio and Wake Lock are instrumented and page visibility is simulated,
 * so this proves the screen measures and records correctly, not that an
 * iPhone passes. Usage: npm run build && node e2e/device.cjs
 */
const { chromium, devices } = require('playwright')
const { spawn } = require('child_process')
const path = require('path')

const PORT = 4179
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
  const context = await browser.newContext({ ...iphone, deviceScaleFactor: 1, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', acceptDownloads: true })
  await context.addInitScript(() => {
    window.__osc = 0
    const C = window.AudioContext
    if (C) {
      const orig = C.prototype.createOscillator
      C.prototype.createOscillator = function () {
        window.__osc++
        return orig.call(this)
      }
    }
    window.__wl = { requested: 0, released: 0, sentinels: [] }
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () => {
          window.__wl.requested++
          const listeners = []
          const s = {
            released: false,
            async release() {
              if (!s.released) {
                s.released = true
                window.__wl.released++
                listeners.forEach((f) => f())
              }
            },
            addEventListener(type, f) {
              if (type === 'release') listeners.push(f)
            },
          }
          window.__wl.sentinels.push(s)
          return s
        },
      },
    })
    // Simulated visibility: tests flip window.__setVisible(false/true).
    let visible = true
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (visible ? 'visible' : 'hidden') })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => !visible })
    window.__setVisible = (v) => {
      visible = v
      document.dispatchEvent(new Event('visibilitychange'))
    }
  })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.clock.install({ time: new Date('2026-11-27T08:00:00-03:00') })

  const tones = async () => (await page.evaluate(() => window.__osc)) / 2
  const card = (id) => page.locator(`[data-check="${id}"]`)
  const badge = (id) => card(id).locator('.badge').first().innerText()
  const lines = (id) => card(id).locator(`[data-testid="lines-${id}"]`).innerText()
  const setVisible = (v) => page.evaluate((x) => window.__setVisible(x), v)

  try {
    await page.goto(BASE)
    await page.getByRole('link', { name: 'Ajustes', exact: true }).click()
    await page.getByRole('link', { name: 'Verificar este aparelho' }).click()
    await page.getByRole('heading', { name: /Verificação do aparelho/ }).waitFor()
    assert((await page.locator('[data-check]').count()) === 4, 'four checks shown')
    assert(/Aberto pela tela de início\s*não/.test(await page.locator('.card').first().innerText()), 'browser tab reported as not installed')
    log('screen opens from Ajustes with four checks and the device info')

    // 1. Storage
    await card('storage').getByRole('button', { name: 'Verificar' }).click()
    await until(async () => /Gravar e ler: ok/.test(await lines('storage').catch(() => '')), 'storage lines')
    const st = await lines('storage')
    assert(/Protegido contra limpeza automática: (sim|não)/.test(st) && /Dados neste aparelho desde/.test(st), `storage details: ${st}`)
    log(`storage: ${await badge('storage')} (${st.split('\n')[0]})`)

    // 2. Sound: tapped plays, delayed (no gesture) plays after 5 s
    await card('sound').getByRole('button', { name: 'Tocar agora' }).click()
    assert((await tones()) === 1, 'tone after tap')
    await card('sound').getByRole('button', { name: 'Ouvi', exact: true }).click()
    await card('sound').getByRole('button', { name: 'Tocar em 5 s' }).click()
    await page.clock.fastForward(4000)
    assert((await tones()) === 1, 'delayed tone not before 5 s')
    await page.clock.fastForward(1500)
    await until(async () => (await tones()) === 2, 'delayed tone')
    await card('sound').getByRole('button', { name: 'Não ouvi' }).click()
    await until(async () => (await badge('sound')) === 'Atenção', 'sound warn')
    log('sound: tapped and delayed tones played; answers recorded (heard / not heard = Atenção)')

    // 3. Screen on: passes after the full time, fails when the screen goes off
    await card('screen').getByRole('button', { name: '1:00' }).click()
    await card('screen').getByRole('button', { name: 'Iniciar' }).click()
    await card('screen').locator('[data-testid="screen-countdown"]').waitFor()
    assert((await page.evaluate(() => window.__wl.requested)) === 1, 'wake lock requested')
    await page.clock.fastForward(61_000)
    await until(async () => (await badge('screen')) === 'OK', 'screen pass')
    assert((await page.evaluate(() => window.__wl.released)) === 1, 'wake lock released at the end')
    log('screen on: 1:00 without touch = OK, lock released at the end')
    await card('screen').getByRole('button', { name: 'Refazer' }).click()
    await card('screen').locator('[data-testid="screen-countdown"]').waitFor()
    await page.clock.fastForward(10_000)
    await setVisible(false)
    await setVisible(true)
    await until(async () => (await badge('screen')) === 'Falhou', 'screen fail on hidden')
    assert(/A tela apagou/.test(await lines('screen')), 'hidden reason shown')
    log('screen on: page hidden during the test = Falhou')
    await card('screen').getByRole('button', { name: 'Refazer' }).click()
    await card('screen').locator('[data-testid="screen-countdown"]').waitFor()
    await until(async () => (await badge('screen')) === 'Pendente', 'screen test restarted')
    await page.evaluate(() => window.__wl.sentinels.at(-1).release())
    await until(async () => /liberou o bloqueio/.test(await lines('screen').catch(() => '')), 'early release reason shown')
    assert((await badge('screen')) === 'Falhou', 'screen fail on early release')
    log('screen on: lock released by the system while visible = Falhou')

    // 4. Background: 40 s away, countdown from timestamps, sound after return
    await card('background').getByRole('button', { name: 'Iniciar' }).click()
    await card('background').locator('[data-testid="background-countdown"]').waitFor()
    await setVisible(false)
    await page.clock.fastForward(40_000)
    await setVisible(true)
    await until(async () => /Fora do app: 0:40/.test(await lines('background').catch(() => '')), 'away time')
    const bg = await lines('background')
    assert(/terminou há 0:10/.test(bg) && /voltou sem recarregar/.test(bg), `background details: ${bg}`)
    const before = await tones()
    await card('background').getByRole('button', { name: 'Tocar som' }).click()
    assert((await tones()) === before + 1, 'tone after return')
    await card('background').getByRole('button', { name: 'Ouvi', exact: true }).click()
    await until(async () => (await badge('background')) === 'OK', 'background pass')
    log('background: 0:40 away, countdown "terminou há 0:10", sound after return = OK')

    // Too short away
    await card('background').getByRole('button', { name: 'Refazer' }).click()
    await card('background').locator('[data-testid="background-countdown"]').waitFor()
    await setVisible(false)
    await page.clock.fastForward(3000)
    await setVisible(true)
    await card('background').getByText('menos de 10 s').waitFor()
    log('background: under 10 s away asks to redo')

    // Reload while away (iOS discarded the page)
    await card('background').getByRole('button', { name: 'Refazer' }).click()
    await card('background').locator('[data-testid="background-countdown"]').waitFor()
    await page.clock.fastForward(20_000)
    await page.reload()
    await page.clock.fastForward(1000)
    await until(async () => /recarregou o app/.test(await lines('background').catch(() => '')), 'reload detected')
    await card('background').getByRole('button', { name: 'Tocar som' }).click()
    await card('background').getByRole('button', { name: 'Ouvi', exact: true }).click()
    await until(async () => (await badge('background')) === 'Atenção', 'background warn on reload')
    log('background: reload detected from the saved test = Atenção')

    // 5. Results survive the reload; export and new run
    assert((await badge('sound')) === 'Atenção' && (await badge('screen')) === 'Falhou', 'results kept after reload')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar relatório' }).click()])
    const file = await download.path()
    const json = JSON.parse(require('fs').readFileSync(file, 'utf8'))
    assert(json.format === 'frame-device-check' && json.report.sound.heardDelayed === false && json.report.background.reloaded === true, 'exported JSON')
    log(`results kept after reload; report exported (${download.suggestedFilename()})`)
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
    await page.getByRole('button', { name: 'Copiar resumo' }).click()
    await page.getByText('Resumo copiado.').waitFor()
    const text = await page.evaluate(() => navigator.clipboard.readText())
    assert(/Som do fim do descanso: Atenção/.test(text) && /Tela ligada durante o treino: Falhou/.test(text), `summary text: ${text}`)
    log('summary copied as text')
    await page.getByRole('button', { name: 'Nova verificação' }).click()
    await page.locator('[data-testid="device-check-history"]').first().waitFor()
    assert((await badge('sound')) === 'Pendente', 'new run starts pending')
    log('new run starts pending; previous one listed')

    assert(errors.length === 0, `console errors: ${errors.join(' | ')}`)
    log('no console errors')
    console.log('\nDEVICE CHECK E2E PASSED')
  } catch (err) {
    console.error('\nDEVICE CHECK E2E FAILED:', err.message)
    await page.screenshot({ path: path.join(__dirname, 'device-failure.png') }).catch(() => {})
    process.exitCode = 1
  } finally {
    await browser.close()
    server?.kill()
  }
})()
