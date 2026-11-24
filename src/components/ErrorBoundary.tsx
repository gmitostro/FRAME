import { Component, type ReactNode } from 'react'
import { t } from '../i18n'

interface State {
  error: Error | null
}

/** Last-resort screen. Data lives in IndexedDB, so a reload is safe. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[FRAME] render error', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="shell">
        <div className="empty" style={{ marginTop: '20vh' }}>
          <h1 style={{ fontSize: 'var(--fs-xl)', color: 'var(--text)' }}>{t('errors.crashTitle')}</h1>
          <p>{t('errors.crashBody')}</p>
          <button className="btn btn-primary btn-lg" onClick={() => location.reload()}>
            {t('errors.reload')}
          </button>
        </div>
      </div>
    )
  }
}
