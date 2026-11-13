import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmModal } from './Modal'

const UnsavedChangesContext = createContext(null)

export function UnsavedChangesProvider({ children }) {
  const { t } = useTranslation()

  const dirtyRef = useRef(false)
  const bypassRef = useRef(false)
  const popSuppressRef = useRef(false)
  const pendingActionRef = useRef(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const setDirty = useCallback((value) => {
    dirtyRef.current = !!value
  }, [])

  const markSaved = useCallback(() => {
    dirtyRef.current = false
  }, [])

  const showGuard = useCallback((action) => {
    if (!dirtyRef.current) {
      if (action) action()
      return
    }
    pendingActionRef.current = action
    setConfirmOpen(true)
  }, [])

  const handleLeave = () => {
    markSaved()
    setConfirmOpen(false)
    const action = pendingActionRef.current
    pendingActionRef.current = null
    if (action) action()
  }

  const handleStay = () => {
    setConfirmOpen(false)
    pendingActionRef.current = null
  }

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    const onClick = (e) => {
      if (bypassRef.current) {
        bypassRef.current = false
        return
      }
      if (!dirtyRef.current) return
      const anchor = e.target.closest?.('a[href]')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('http') ||
        href.startsWith('//') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        return
      }
      let currentUrl
      try {
        currentUrl = new URL(href, window.location.origin)
      } catch {
        currentUrl = null
      }
      if (currentUrl && currentUrl.pathname === window.location.pathname) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      showGuard(() => {
        bypassRef.current = true
        anchor.click()
      })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [showGuard])

  useEffect(() => {
    const onPopState = () => {
      if (!dirtyRef.current) return
      if (popSuppressRef.current) {
        popSuppressRef.current = false
        return
      }
      popSuppressRef.current = true
      window.history.go(1)
      showGuard(null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [showGuard])

  return (
    <UnsavedChangesContext.Provider value={{ setDirty, markSaved, showGuard }}>
      {children}
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={handleStay}
        onConfirm={handleLeave}
        title={t('common.unsavedTitle')}
        message={t('common.unsavedMessage')}
        confirmText={t('common.discard')}
        cancelText={t('common.stay')}
      />
    </UnsavedChangesContext.Provider>
  )
}

export function useUnsaved() {
  const ctx = useContext(UnsavedChangesContext)
  if (!ctx) throw new Error('useUnsaved must be used within UnsavedChangesProvider')
  return ctx
}