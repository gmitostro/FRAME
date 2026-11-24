import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { db, requestPersistentStorage, syncExerciseSeed } from './data/db'
import { t } from './i18n'
import './styles/tokens.css'
import './styles/app.css'
import './styles/workout.css'

function StorageError() {
  return (
    <div className="shell">
      <div className="empty" style={{ marginTop: '20vh' }}>
        <h1 style={{ fontSize: 'var(--fs-xl)', color: 'var(--text)' }}>{t('errors.crashTitle')}</h1>
        <p>{t('errors.storage')}</p>
        <button className="btn btn-primary btn-lg" onClick={() => location.reload()}>
          {t('errors.reload')}
        </button>
      </div>
    </div>
  )
}

async function boot() {
  const root = createRoot(document.getElementById('root')!)
  try {
    await db.open()
  } catch (err) {
    console.error('[FRAME] database error', err)
    root.render(<StorageError />)
    return
  }
  try {
    await syncExerciseSeed()
  } catch (err) {
    console.error('[FRAME] exercise seed sync failed', err)
  }
  void requestPersistentStorage()
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
