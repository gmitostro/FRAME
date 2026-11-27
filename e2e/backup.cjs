/* Backup reminder e2e: the home reminder appears when finished workouts are
 * not in a backup, the shortcut exports and clears it, and Ajustes shows the
 * last backup (Chromium, iPhone 13 viewport).
 * Usage: npm run build && node e2e/backup.cjs
 */
const { chromium, devices } = require('playwright')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const PORT = 4181
const BASE = `http://localhost:${PORT}/`
const DAY = 86_400_000
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

  /** Writes rows straight into IndexedDB (then the page is reloaded). */
  const put = (store, row) =>
    page.evaluate(
      ([store, row]) =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open('frame')
          req.onerror = () => reject(req.error)
          req.onsuccess = () => {
            const db = req.result
            const tx = db.transaction(store, 'readwrite')
            tx.objectStore(store).put(row)
            tx.oncomplete = () => (db.close(), resolve(true))
            tx.onerror = () => reject(tx.error)
          }
        }),
      [store, row],
    )
  const session = (id, endedAt) => ({
    id, programId: null, templateId: null, templateName: 'Treino E2E', status: 'completed',
    startedAt: endedAt - 3_600_000, endedAt, pausedAt: null, pausedMs: 0, currentIndex: 0,
    exercises: [], exerciseIds: [], restTimer: null, updatedAt: endedAt,
  })
  const reminder = page.locator('.backup-reminder')
  const goHome = async () => {
    await page.goto(BASE)
    await page.getByText('Semana').first().waitFor()
  }

  try {
    await goHome()
    assert((await reminder.count()) === 0, 'no reminder without workouts')
    await page.getByRole('link', { name: 'Ajustes', exact: true }).click()
    await page.getByText('Nenhum backup exportado neste aparelho.').waitFor()
    log('fresh app: no reminder; Ajustes says no backup yet')

    const now = Date.now()
    await put('sessions', session('e2e-1', now - 2 * DAY))
    await goHome()
    await reminder.waitFor()
    assert((await reminder.innerText()).includes('ainda não têm backup'), 'first-backup text')
    log('after a finished workout: reminder asks for a first backup')

    const [dl] = await Promise.all([page.waitForEvent('download'), reminder.getByRole('button', { name: 'Exportar backup agora' }).click()])
    const file = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'))
    assert(file.format === 'frame-backup' && file.data.sessions.some((s) => s.id === 'e2e-1'), 'exported file holds the workout')
    await page.getByText('Backup exportado.').waitFor()
    await reminder.waitFor({ state: 'detached' })
    log(`shortcut exported ${dl.suggestedFilename()} and the reminder went away`)

    await page.getByRole('link', { name: 'Ajustes', exact: true }).click()
    await page.getByText(/^Último backup: hoje, /).waitFor()
    log('Ajustes: "Último backup: hoje"')

    // Old backup + a workout after it
    await put('meta', { key: 'lastBackupAt', value: now - 8 * DAY })
    await goHome()
    await reminder.waitFor()
    assert((await reminder.innerText()).includes('1 treino ainda não'), 'singular count')
    await put('sessions', session('e2e-2', now - 1000))
    await goHome()
    await reminder.waitFor()
    const text = await reminder.innerText()
    assert(text.includes('Último backup há 8 dias') && text.includes('2 treinos ainda não estão nele'), `old-backup text: ${text}`)
    log('backup 8 days old with 2 newer workouts: reminder shown with counts')

    await page.getByRole('link', { name: 'Ajustes', exact: true }).click()
    await page.getByText(/há 8 dias\. 2 treinos depois dele\.$/).waitFor()
    log('Ajustes: date, days and workouts since the last backup')

    // Recent backup but older than the workouts: quiet until 7 days pass
    await put('meta', { key: 'lastBackupAt', value: now - 3 * DAY })
    await goHome()
    assert((await reminder.count()) === 0, 'no reminder when the backup is 3 days old')
    log('backup 3 days old: no reminder')

    assert(errors.length === 0, `console errors: ${errors.join(' | ')}`)
    log('no console errors')
    console.log('\nBACKUP E2E PASSED')
  } catch (err) {
    console.error('\nBACKUP E2E FAILED:', err.message)
    if (errors.length) console.error('console errors:', errors)
    await page.screenshot({ path: path.join(require('os').tmpdir(), 'frame-backup-fail.png') }).catch(() => {})
    process.exitCode = 1
  } finally {
    await browser.close()
    server?.kill()
  }
})()
