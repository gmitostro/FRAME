import { X } from 'lucide-react'
import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../i18n'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/** Bottom sheet dialog: reachable with one thumb. */
export function Sheet({ open, title, onClose, children, footer }: SheetProps) {
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2 id={id}>{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </>,
    document.body,
  )
}

interface ConfirmProps {
  open: boolean
  title: string
  body?: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmSheet({ open, title, body, confirmLabel, danger, onConfirm, onClose }: ConfirmProps) {
  return (
    <Sheet
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-block" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className={`btn btn-block ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel ?? t('common.confirm')}
          </button>
        </>
      }
    >
      {body && <div className="muted">{body}</div>}
    </Sheet>
  )
}
