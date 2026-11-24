import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../i18n'

export function PageHeader({ title, eyebrow, back, actions }: { title: string; eyebrow?: string; back?: string | true; actions?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="page-header">
      {back && (
        <button
          className="btn btn-ghost btn-icon"
          aria-label={t('common.back')}
          onClick={() => (back === true ? navigate(-1) : navigate(back))}
          style={{ marginLeft: -10 }}
        >
          <ChevronLeft size={26} />
        </button>
      )}
      <h1>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        {title}
      </h1>
      {actions}
    </header>
  )
}
