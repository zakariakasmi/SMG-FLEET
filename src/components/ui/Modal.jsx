import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { XClose, AlertTriangle, InfoCircle, Loading02 } from '@untitledui/icons'
import Button from './Button'

const SF_PROPS = {}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideHeader = false,
  headerCls,
  bodyCls,
  footerCls,
  scrollable = false,
}) {
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  const backdropRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      const backdrops = Array.from(document.querySelectorAll('[data-modal-backdrop]'))
      if (backdrops.length && backdrops[backdrops.length - 1] !== backdropRef.current) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div ref={backdropRef} data-modal-backdrop className="fixed inset-0 z-50 overflow-y-auto overscroll-contain">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/25 transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative w-full min-w-0 ${sizes[size]} transform rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg transition-all ${
            scrollable ? 'flex max-h-[calc(100vh-2.5rem)] flex-col overflow-hidden' : ''
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {!hideHeader && (
            <div className={headerCls || 'flex items-start justify-between px-6 pt-5 pb-1'}>
              <div className="min-w-0">
                <h3 className="text-[17px] font-semibold leading-snug text-foreground">
                  {title}
                </h3>
                {description && (
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="ml-3 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <XClose {...SF_PROPS} className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Body */}
          <div
            className={`${
              scrollable ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain' : ''
            } ${bodyCls || 'p-6 text-muted-foreground'}`}
          >
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className={footerCls || 'flex items-center justify-end gap-3 px-6 py-5'}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'danger',
  loading = false,
}) {
  const { t } = useTranslation()

  const danger = variant === 'danger'
  const accent = danger ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'
  const Icon = danger ? AlertTriangle : InfoCircle

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      hideHeader
      bodyCls="px-8 pt-8 pb-7"
      footerCls="grid grid-cols-2"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex min-h-[48px] cursor-pointer items-center justify-center font-semibold text-primary transition-colors focus:outline-none disabled:opacity-40 hover:bg-muted"
            style={{ borderRight: '1px solid hsl(var(--border))' }}
          >
            {cancelText || t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 font-semibold transition-colors focus:outline-none disabled:opacity-40 hover:bg-muted"
            style={{ color: accent }}
          >
            {loading && <Loading02 {...SF_PROPS} className="animate-spin -ml-1 h-4 w-4" />}
            {confirmText || t('common.confirm')}
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-2.5 text-center">
        <div
          className="flex items-center justify-center rounded-full bg-muted"
          style={{ width: 48, height: 48, color: accent }}
        >
          <Icon {...SF_PROPS} className="h-6 w-6" />
        </div>
        <h3 className="text-[16px] font-semibold text-foreground">{title}</h3>
        <p className="text-[14px] font-medium leading-relaxed text-muted-foreground">{message}</p>
      </div>
    </Modal>
  )
}