import { AlertCircle, Check } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

type Kind = 'info' | 'error'
interface ToastItem {
  id: number
  text: string
  kind: Kind
  action?: { label: string; run: () => void }
}

interface ToastApi {
  show: (text: string, opts?: { kind?: Kind; action?: ToastItem['action']; durationMs?: number }) => void
}

const Ctx = createContext<ToastApi>({ show: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const show = useCallback<ToastApi['show']>((text, opts = {}) => {
    const id = ++seq.current
    setItems((xs) => [...xs.slice(-2), { id, text, kind: opts.kind ?? 'info', action: opts.action }])
    const ms = opts.durationMs ?? (opts.action ? 8000 : 3200)
    if (ms > 0) setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), ms)
  }, [])
  const api = useMemo(() => ({ show }), [show])
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((x) => (
          <div key={x.id} className={`toast ${x.kind === 'error' ? 'error' : ''}`}>
            {x.kind === 'error' ? <AlertCircle size={18} color="var(--danger)" /> : <Check size={18} color="var(--accent)" />}
            <span className="grow">{x.text}</span>
            {x.action && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  x.action?.run()
                  setItems((xs) => xs.filter((y) => y.id !== x.id))
                }}
              >
                {x.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
