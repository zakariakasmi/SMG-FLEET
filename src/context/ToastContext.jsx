import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, InfoCircle, XClose } from '@untitledui/icons'

const ToastContext = createContext(null)

const SF = { strokeWidth: 1.75, fill: 'none' }
const EXIT_MS = 240

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: InfoCircle,
}

const BADGE_COLORS = {
  success: 'bg-success/10 text-success',
  error: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-muted text-muted-foreground',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now()
    const toast = { id, message, type, leaving: false }
    setToasts((prev) => [...prev, toast])

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
      }, Math.max(0, duration - EXIT_MS))
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, EXIT_MS)
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-4 right-4 z-[60] flex flex-col gap-2.5"
      style={{ width: 'min(340px, calc(100vw - 2rem))' }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

function Toast({ toast, onRemove }) {
  const Icon = ICONS[toast.type] || InfoCircle

  return (
    <div
      className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-card/95 p-4 shadow-md backdrop-blur-md will-change-transform"
      style={{ animation: `${toast.leaving ? 'slideOut' : 'slideIn'} 0.28s ${toast.leaving ? 'ease-in forwards' : 'ease-out'}` }}
    >
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md ${BADGE_COLORS[toast.type]}`}>
        <Icon {...SF} className="h-5 w-5" />
      </div>
      <div className="mt-0.5 flex-1 text-[14px] font-medium leading-snug text-foreground">{toast.message}</div>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Dismiss"
      >
        <XClose {...SF} className="h-4 w-4" />
      </button>
    </div>
  )
}

export function useToast() {
  return useContext(ToastContext)
}