/* v0.3 data foundation e2e: load classification, captions, RIR origin and
 * compatibility with data written before v0.3 (Chromium, iPhone 13 viewport).
 * Usage: npm run build && node e2e/data.cjs
 */
const { chromium, devices } = require('playwright')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

const PORT = 4180
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
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  /** The active session as stored in IndexedDB (source of truth). */
  const activeSession = () =>
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
              resolve(q.result.find((x) => x.status === 'active') ?? null)
            }
          }
        }),
    )
  const fieldLabels = () => page.locator('.logger .logger-grid .field-label').allInnerTexts()
  async function logSet() {
    const before = await page.locator('.set-row.done').count()
    await page.locator('.logger-submit').click()
    await until(async () => (await page.locator('.set-row.done').count()) === before + 1, 'set saved')
  }
  async function info(label) {
    const row = page.locator('.card .row.between', { has: page.locator('span.muted', { hasText: new RegExp(`^${label}$`) }) })
    return (await row.innerText()).replace(label, '').trim()
  }

  try {
    await page.goto(BASE)
    await page.getByText('Semana').first().waitFor()

    // 1. Library shows the classification
    await page.getByRole('link', { name: 'Exercícios', exact: true }).click()
    await page.getByPlaceholder('Buscar exercício').fill('remada unilateral halter')
    await page.locator('.list-row', { hasText: 'Remada unilateral com halter' }).click()
    await page.getByText('Recordes registrados').waitFor()
    assert((await info('Tipo de carga')) === 'Carga externa', 'remada: carga externa')
    assert((await info('Como registrar a carga')) === 'Por halter', 'remada: por halter')
    assert((await info('Unilateral')) === 'Sim', 'remada: unilateral')
    assert((await info('Medida')) === 'Repetições', 'remada: repetições')
    log('library detail: Remada unilateral = carga externa, por halter, unilateral, repetições')

    // 2. Custom assisted exercise
    await page.goto(BASE + '#/exercicios/novo')
    await page.locator('#ex-name').fill('Barra fixa assistida')
    await page.locator('#ex-primary').selectOption('lats')
    await page.locator('#ex-eq').selectOption('machine')
    await page.locator('#ex-load-type').selectOption('assisted')
    assert(await page.getByText('Registre a assistência da máquina.').isVisible(), 'assisted help text')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await page.getByText('Recordes registrados').waitFor()
    assert((await info('Tipo de carga')) === 'Peso corporal assistido', 'custom: assistido')
    log('custom exercise saved as "Peso corporal assistido"')

    // 3. Workout with one exercise of each kind
    await page.getByRole('link', { name: 'Treinos', exact: true }).click()
    await page.getByRole('button', { name: 'Novo treino' }).click()
    for (const [q, name] of [
      ['remada unilateral halter', 'Remada unilateral com halter'],
      ['barra fixa assistida', 'Barra fixa assistida'],
      ['roda abdominal', 'Roda abdominal'],
      ['barra fixa pronada', 'Barra fixa pronada'],
    ]) {
      await page.getByRole('button', { name: 'Adicionar exercício' }).click()
      await page.getByPlaceholder('Buscar exercício').fill(q)
      await page.locator('.sheet .list-row', { hasText: name }).first().click()
      await page.locator('article', { hasText: name }).first().waitFor()
    }
    await page.getByRole('button', { name: 'Voltar' }).click()
    await page.locator('article', { has: page.locator('.card-title', { hasText: /^Novo treino$/ }) }).getByRole('button', { name: 'Iniciar' }).click()
    await page.locator('.wk-name', { hasText: 'Remada unilateral com halter' }).waitFor()

    // Remada: per dumbbell, per side
    await page.locator('.logger-submit').waitFor()
    let labels = await fieldLabels()
    assert(labels[0] === 'Carga por halter (kg)' && labels[1] === 'Reps por lado', `remada captions ${labels}`)
    await logSet() // warm-up (moderate compound → 1 prescribed)
    assert((await page.locator('.rir-seg button.suggested').count()) === 1, 'pre-filled RIR shown as suggestion')
    assert(await page.getByText('Sugerido: toque para confirmar').isVisible(), 'suggested helper text')
    await logSet() // working set 1, RIR untouched
    await page.locator('.rir-seg button', { hasText: /^1$/ }).click()
    assert((await page.locator('.rir-seg button.suggested').count()) === 0, 'tapped RIR is no longer a suggestion')
    await logSet() // working set 2, RIR tapped
    let s = await activeSession()
    const sets = s.exercises[0].sets.map((x) => [x.kind, x.rir, x.rirSource ?? null])
    assert(JSON.stringify(sets) === JSON.stringify([['warmup', null, null], ['working', 2, 'default'], ['working', 1, 'user']]), `stored RIR origin ${JSON.stringify(sets)}`)
    assert(JSON.stringify(s.exercises[0].loadProfile) === JSON.stringify({ loadType: 'external', loadBasis: 'perDumbbell', unilateral: true, measure: 'reps' }), `snapshot ${JSON.stringify(s.exercises[0].loadProfile)}`)
    log('captions "Carga por halter (kg)" / "Reps por lado"; RIR stored as default vs user; snapshot saved')

    // Edit: reps only keeps origin; choosing an RIR marks user
    const repsBefore = (await activeSession()).exercises[0].sets[1].reps
    await page.locator('.set-row.done').nth(1).click()
    await page.locator('.sheet').getByRole('button', { name: 'Aumentar Reps por lado' }).click()
    await page.locator('.sheet').getByRole('button', { name: 'Salvar' }).click()
    await until(async () => (await activeSession()).exercises[0].sets[1].reps === repsBefore + 1, `reps edit saved (${repsBefore} + 1)`)
    assert((await activeSession()).exercises[0].sets[1].rirSource === 'default', 'reps-only edit keeps "default"')
    await page.locator('.set-row.done').nth(1).click()
    await page.locator('.sheet .rir-seg button', { hasText: /^3$/ }).click()
    await page.locator('.sheet').getByRole('button', { name: 'Salvar' }).click()
    await until(async () => (await activeSession()).exercises[0].sets[1].rirSource === 'user', 'RIR edit marks user')
    log('set edit: reps-only keeps "default", choosing RIR marks "user"')

    // Other kinds
    await page.locator('.wk-footer').getByRole('button', { name: 'Próximo' }).click()
    await page.locator('.wk-name', { hasText: 'Barra fixa assistida' }).waitFor()
    labels = await fieldLabels()
    assert(labels[0] === 'Assistência (kg)', `assisted caption ${labels}`)
    await page.locator('.wk-footer').getByRole('button', { name: 'Próximo' }).click()
    await page.locator('.wk-name', { hasText: 'Roda abdominal' }).waitFor()
    assert((await page.locator('.logger .logger-grid input').count()) === 0 && (await fieldLabels()).join() === 'Reps', 'no weight field for no-load exercise')
    await logSet()
    s = await activeSession()
    assert(s.exercises[2].sets[0].weightKg === 0, 'no-load set stored with 0 kg')
    await page.locator('.wk-footer').getByRole('button', { name: 'Próximo' }).click()
    await page.locator('.wk-name', { hasText: 'Barra fixa pronada' }).waitFor()
    labels = await fieldLabels()
    assert(labels[0] === 'Carga adicional (kg)', `bodyweight caption ${labels}`)
    log('captions: "Assistência (kg)", no weight field for Roda abdominal, "Carga adicional (kg)"')

    // 4. Compatibility: a session written before v0.3 (no snapshot, no RIR origin) keeps working
    await page.getByRole('link', { name: 'Voltar' }).first().click()
    await page.getByRole('link', { name: 'Ajustes', exact: true }).click()
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar backup' }).click()])
    const backup = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'))
    for (const ses of backup.data.sessions) for (const e of ses.exercises) {
      delete e.loadProfile
      for (const x of e.sets) delete x.rirSource
    }
    for (const e of backup.data.exercises) for (const f of ['loadType', 'loadBasis', 'unilateral', 'measure']) delete e[f]
    const legacy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'frame-legacy-')), 'legacy.json')
    fs.writeFileSync(legacy, JSON.stringify(backup))
    await page.locator('input[type=file][accept*="json"]').last().setInputFiles(legacy)
    await page.locator('.sheet').getByRole('button', { name: 'Restaurar backup' }).click()
    await page.getByText('Backup restaurado.').waitFor()
    await page.getByRole('link', { name: 'Início', exact: true }).click()
    await page.locator('.live-banner a').click()
    await page.locator('.wk-name').waitFor()
    await page.locator('.wk-footer').getByRole('button', { name: 'Exercícios do treino' }).click()
    await page.locator('.sheet .list-row', { hasText: 'Remada unilateral com halter' }).click()
    await page.locator('.wk-name', { hasText: 'Remada unilateral com halter' }).waitFor()
    await page.getByRole('button', { name: 'Série extra' }).click()
    labels = await fieldLabels()
    assert(labels[0] === 'Carga por halter (kg)' && labels[1] === 'Reps por lado', `legacy session falls back to library captions ${labels}`)
    await logSet()
    s = await activeSession()
    assert(s.exercises[0].loadProfile === undefined, 'legacy snapshot stays absent (not invented)')
    assert(s.exercises[0].sets[1].rirSource === undefined, 'legacy RIR origin stays unknown')
    assert(s.exercises[0].sets.at(-1).rirSource === 'default', 'new set on a legacy session records its origin')
    // the custom exercise lost its explicit type in the legacy file → back to equipment default
    log('pre-v0.3 data restored: unknown fields stay unknown, captions fall back, new sets record origin')

    assert(errors.length === 0, `console errors: ${errors.join(' | ')}`)
    log('no console errors')
    console.log('\nDATA E2E PASSED')
  } catch (err) {
    console.error('\nDATA E2E FAILED:', err.message)
    if (errors.length) console.error('console errors:', errors)
    process.exitCode = 1
  } finally {
    await browser.close()
    server?.kill()
  }
})()
