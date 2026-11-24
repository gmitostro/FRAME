/* End-to-end smoke test on an iPhone-sized viewport (Chromium emulation).
 * Usage: npm run build && npm run e2e   (SHOTS=1 saves screenshots to e2e/shots)
 */
const { chromium, devices } = require('playwright')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const PORT = 4174
const BASE = `http://localhost:${PORT}/`
const SHOTS = process.env.SHOTS === '1'
const shotDir = path.join(__dirname, 'shots')
let step = 0

function log(msg) {
  console.log(`  ✓ ${msg}`)
}

async function shot(page, name) {
  if (!SHOTS) return
  fs.mkdirSync(shotDir, { recursive: true })
  await page.screenshot({ path: path.join(shotDir, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: false })
}

/** Polls until fn() returns a truthy value (UI updates after an IndexedDB write). */
async function until(fn, msg, timeout = 4000) {
  const end = Date.now() + timeout
  let last
  while (Date.now() < end) {
    last = await fn()
    if (last) return last
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`Timed out waiting: ${msg}`)
}

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`)
}

async function startServer() {
  try {
    if ((await fetch(BASE)).ok) return null // reuse a running preview server
  } catch {}
  const vite = path.join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js')
  const proc = spawn(process.execPath, [vite, 'preview', '--port', String(PORT), '--strictPort'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' })
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(BASE)
      if (r.ok) return proc
    } catch {}
    await new Promise((r) => setTimeout(r, 200))
  }
  proc.kill()
  throw new Error('preview server did not start')
}

;(async () => {
  const server = await startServer()
  const browser = await chromium.launch()
  const { defaultBrowserType: _ignored, ...iphone } = devices['iPhone 13']
  const context = await browser.newContext({ ...iphone, deviceScaleFactor: Number(process.env.SCALE ?? 1), acceptDownloads: true })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  try {
    await page.goto(BASE)
    await page.getByText('FRAME', { exact: true }).first().waitFor()
    await page.getByText('Semana').first().waitFor()
    await page.getByText('Treino de hoje').waitFor()
    log('home loads in pt-BR with today\'s workout')
    await shot(page, 'home-empty')

    // ---- FRFB V1 is loaded ----
    await page.getByRole('link', { name: 'Treinos' }).click()
    await page.getByRole('heading', { name: /Treinos/ }).waitFor()
    await page.getByText('Programa FRFB V1').waitFor()
    for (const [name, n] of [['Frame A', 6], ['Full Body A', 6], ['Frame B', 5], ['Full Body B', 6]]) {
      const txt = await page.locator('article', { has: page.locator('.card-title', { hasText: new RegExp(`^${name}$`) }) }).innerText()
      assert(txt.includes(`${n} exercícios`), `${name} has ${n} exercises: ${txt.replace(/\n/g, ' ')}`)
    }
    await page.locator('article', { has: page.locator('.card-title', { hasText: /^Frame A$/ }) }).getByRole('link', { name: 'Editar' }).click()
    await page.locator('article', { hasText: 'Elevação lateral na máquina' }).first().waitFor()
    await shot(page, 'frame-a')
    log('FRFB V1 ficha loaded (6/6/5/6 exercises)')

    // ---- Build a separate test workout ----
    await page.getByRole('button', { name: 'Voltar' }).click()
    await page.getByRole('button', { name: 'Novo treino' }).click()
    await page.getByText('Adicione os exercícios deste treino').waitFor()
    log('new workout opens with no invented exercises')

    async function addExercise(query, name) {
      await page.getByRole('button', { name: 'Adicionar exercício' }).click()
      await page.getByPlaceholder('Buscar exercício').fill(query)
      await page.locator('.sheet .list-row', { hasText: name }).first().click()
      await page.locator('article', { hasText: name }).first().waitFor()
    }
    await addExercise('supino reto barra', 'Supino reto com barra')
    await addExercise('rosca direta barra', 'Rosca direta com barra')
    const supinoCard = page.locator('article', { hasText: 'Supino reto com barra' })
    await supinoCard.getByRole('button', { name: 'Aumentar Repetições Máx.' }).waitFor()
    const durationText = await page.locator('.card', { hasText: 'Duração estimada' }).innerText()
    assert(/~\d+ min/.test(durationText), `duration estimate shown: ${durationText}`)
    log(`exercises added; estimate: ${durationText.split('\n')[1]}`)
    await shot(page, 'editor')

    // ---- Start workout ----
    await page.getByRole('button', { name: 'Voltar' }).click()
    const testCard = () => page.locator('article', { has: page.locator('.card-title', { hasText: /^Novo treino$/ }) })
    await testCard().getByRole('button', { name: 'Iniciar' }).click()
    await page.waitForURL(/#\/treino$/)
    await page.locator('.wk-name', { hasText: 'Supino reto com barra' }).waitFor()
    await page.getByText('Primeira vez neste exercício.').waitFor()
    log('workout started on first exercise')
    await shot(page, 'workout-start')

    const doneRows = () => page.locator('.set-row.done').count()
    async function logAndWait(buttonName) {
      const before = await doneRows()
      await page.getByRole('button', { name: buttonName }).click()
      await until(async () => (await doneRows()) === before + 1, `${buttonName} saved`)
    }

    // two warm-ups (heavy compound default), then working sets
    for (let i = 0; i < 2; i++) {
      const weight = page.locator('.logger input[aria-label="Carga"]')
      await weight.fill(String(40 + i * 20))
      await weight.blur()
      await logAndWait('Concluir aquecimento')
    }
    const warmText = await page.locator('.set-row.warm.done').allInnerTexts()
    assert(warmText[1].includes('60 kg'), `second warm-up saved with typed load: ${warmText[1]}`)
    assert((await page.locator('.timer-dock').count()) === 0, 'warm-ups do not start the rest timer')
    log('warm-ups logged without starting the timer')

    const weight = page.locator('.logger input[aria-label="Carga"]')
    await weight.fill('80')
    await weight.blur()
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Aumentar Reps' }).click()
    await page.locator('.rir-seg button', { hasText: /^2$/ }).click()
    await logAndWait('Concluir série')
    await page.locator('.timer-dock').waitFor()
    const t1 = await page.locator('.timer-time').innerText()
    assert(/^[23]:\d\d$/.test(t1), `rest timer counting from 3:00, got ${t1}`)
    log(`working set logged; rest timer running (${t1})`)
    await shot(page, 'workout-timer')

    // ---- Reload mid-rest: state and timer must survive ----
    await page.waitForTimeout(2100)
    await page.reload()
    await page.locator('.timer-dock').waitFor()
    const t2 = await page.locator('.timer-time').innerText()
    const toSec = (s) => s.split(':').reduce((a, b) => a * 60 + Number(b), 0)
    assert(toSec(t2) <= toSec(t1) - 2, `timer kept running across reload (${t1} -> ${t2})`)
    assert((await page.locator('.set-row.done').count()) === 3, 'logged sets survive reload')
    log(`reload keeps sets and timer (${t1} → ${t2})`)

    await page.getByRole('button', { name: '+30 s' }).click()
    const t3 = await until(async () => {
      const v = await page.locator('.timer-time').innerText()
      return toSec(v) > toSec(t2) + 20 ? v : null
    }, '+30 s extends the rest')
    await page.getByRole('button', { name: 'Pausar descanso' }).click()
    await page.getByRole('button', { name: 'Continuar descanso' }).waitFor()
    const p1 = await page.locator('.timer-time').innerText()
    await page.waitForTimeout(1500)
    const p2 = await page.locator('.timer-time').innerText()
    assert(p1 === p2, `paused timer stays still (${p1} vs ${p2})`)
    await page.getByRole('button', { name: 'Continuar descanso' }).click()
    log(`+30 s (${t2} → ${t3}), pause and resume work`)

    // second working set is pre-filled with 80 kg x 10
    const prefilled = await page.locator('.logger input[aria-label="Carga"]').inputValue()
    assert(prefilled === '80', `next set pre-filled with last weight, got ${prefilled}`)
    await logAndWait('Concluir série')
    await page.getByText('Exercício concluído').waitFor()
    log('second set pre-filled and logged; exercise complete')

    await page.getByRole('button', { name: /A seguir: Rosca direta com barra/ }).click()
    await page.locator('.wk-name', { hasText: 'Rosca direta com barra' }).waitFor()
    for (let i = 0; i < 2; i++) {
      const w = page.locator('.logger input[aria-label="Carga"]')
      await w.fill('30')
      await w.blur()
      await logAndWait('Concluir série')
    }
    await page.getByText('Todos os exercícios concluídos.').waitFor()
    await shot(page, 'workout-done')
    await page.locator('.card.accent').getByRole('button', { name: 'Finalizar treino' }).click()
    await page.locator('.sheet').getByRole('button', { name: 'Finalizar treino' }).click()
    await page.getByText('Treino concluído').waitFor()
    log('workout finished; summary shown')
    await shot(page, 'summary')

    // ---- History ----
    await page.getByRole('link', { name: 'Ir para o início' }).click()
    await page.getByRole('link', { name: 'Histórico' }).click()
    await page.locator('.list-row', { hasText: 'Novo treino' }).click()
    await page.getByText('80 kg × 10').first().waitFor()
    log('history shows the session with sets')
    await shot(page, 'history-detail')

    // ---- Progression suggestion on next session ----
    await page.getByRole('link', { name: 'Treinos' }).click()
    await testCard().getByRole('button', { name: 'Iniciar' }).click()
    await page.locator('.suggest.up').waitFor()
    const sug = await page.locator('.suggest.up').innerText()
    assert(sug.includes('82,5 kg'), `double progression suggests 82,5 kg, got: ${sug}`)
    log(`progression suggestion: ${sug.split('\n')[1]}`)
    await shot(page, 'suggestion')
    await page.getByRole('button', { name: 'Finalizar treino' }).first().click() // menu button (aria-label)
    await page.getByRole('button', { name: 'Descartar treino' }).click()
    await page.locator('.sheet').getByRole('button', { name: 'Descartar treino' }).click()
    await page.waitForURL(/#\/$/)
    log('second session discarded')

    // ---- Library & settings ----
    await page.getByRole('link', { name: 'Exercícios' }).click()
    await page.getByRole('button', { name: 'Prioridades' }).click()
    const prioCount = await page.locator('.list-row').count()
    assert(prioCount > 10, `priority filter lists exercises (${prioCount})`)
    await shot(page, 'library')
    await page.getByRole('link', { name: 'Ajustes' }).click()
    await page.getByText('Perfis de descanso').waitFor()
    await page.getByText('Programa atual: FRFB V1').waitFor()
    await shot(page, 'settings')
    const [progDl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar ficha' }).click()])
    const prog = JSON.parse(fs.readFileSync(await progDl.path(), 'utf8'))
    assert(prog.format === 'frame-program' && prog.workouts.length === 5, `program export has 5 workouts (${prog.workouts?.length})`)
    log(`program exported (${progDl.suggestedFilename()})`)
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar backup' }).click()])
    const file = await download.path()
    const backup = JSON.parse(fs.readFileSync(file, 'utf8'))
    assert(backup.format === 'frame-backup' && backup.data.sessions.filter((s) => s.status === 'completed').length === 1, 'backup contains the session')
    log(`backup exported (${download.suggestedFilename()})`)

    // ---- Offline ----
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
    await page.waitForTimeout(500)
    await context.setOffline(true)
    await page.reload()
    await page.getByRole('heading', { name: 'Ajustes' }).waitFor({ timeout: 5000 })
    await page.getByRole('link', { name: 'Início' }).click()
    await page.getByText('Semana').first().waitFor({ timeout: 5000 })
    log('app reloads offline from the service worker cache')
    await context.setOffline(false)

    // ---- Untranslated text check ----
    const english = /\b(Start|Finish|Settings|Loading|Workout|Exercise|History|Save|Cancel|Delete|Rest|Sets?)\b/
    for (const route of ['#/', '#/treinos', '#/exercicios', '#/historico', '#/ajustes']) {
      await page.goto(BASE + route)
      await page.waitForTimeout(300)
      const text = await page.locator('body').innerText()
      const hit = text.split('\n').find((line) => english.test(line) && !/Full Body|FRFB|Frame/.test(line))
      assert(!hit, `untranslated text on ${route}: "${hit}"`)
    }
    log('no English UI strings found on main screens')

    assert(errors.length === 0, `console errors: ${errors.join(' | ')}`)
    log('no console errors')
    console.log('\nE2E PASSED')
  } catch (err) {
    await shot(page, 'failure')
    console.error('\nE2E FAILED:', err.message)
    if (errors.length) console.error('console errors:', errors)
    process.exitCode = 1
  } finally {
    await browser.close()
    server?.kill()
  }
})()
