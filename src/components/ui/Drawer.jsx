import { useEffect } from 'react'
import { XClose } from '@untitledui/icons'

export default function Drawer({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/20 transition-opacity duration-200"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 flex w-full flex-col bg-card text-card-foreground shadow-lg sm:w-[420px]">
        {title && (
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <XClose className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}