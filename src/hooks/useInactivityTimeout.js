import { useEffect, useCallback, useRef, useState } from 'react'

const ACTIVITY_KEY = 'lastActivity'
const TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
const WARNING_MS = 13 * 60 * 1000 // 13 minutes (2 min warning)
const CHECK_INTERVAL = 30 * 1000 // check every 30 seconds
const THROTTLE_MS = 60 * 1000 // throttle localStorage writes to 1 min

const ACTIVITY_EVENTS = [
  'mousemove',
  'keydown',
  'click',
  'scroll',
  'touchstart',
  'mousedown',
]

export function useInactivityTimeout(logout, onWarning, onTimeout) {
  const [showWarning, setShowWarning] = useState(false)
  const lastWriteRef = useRef(0)
  const warningShownRef = useRef(false)

  const updateActivity = useCallback(() => {
    const now = Date.now()
    if (now - lastWriteRef.current > THROTTLE_MS) {
      localStorage.setItem(ACTIVITY_KEY, String(now))
      lastWriteRef.current = now
    }
  }, [])

  const resetTimer = useCallback(() => {
    setShowWarning(false)
    warningShownRef.current = false
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
    lastWriteRef.current = Date.now()
  }, [])

  useEffect(() => {
    if (!logout) return

    const handleActivity = () => {
      updateActivity()
      if (showWarning) {
        resetTimer()
      }
    }

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true })
    )

    // Initialize timestamp if missing
    if (!localStorage.getItem(ACTIVITY_KEY)) {
      localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
    }

    const interval = setInterval(() => {
      const last = Number(localStorage.getItem(ACTIVITY_KEY)) || Date.now()
      const elapsed = Date.now() - last

      if (elapsed >= TIMEOUT_MS) {
        setShowWarning(false)
        warningShownRef.current = false
        localStorage.removeItem(ACTIVITY_KEY)
        onTimeout?.()
        logout()
      } else if (elapsed >= WARNING_MS && !warningShownRef.current) {
        warningShownRef.current = true
        setShowWarning(true)
        onWarning?.()
      }
    }, CHECK_INTERVAL)

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      )
      clearInterval(interval)
    }
  }, [logout, updateActivity, resetTimer, showWarning, onWarning, onTimeout])

  return { showWarning, resetTimer, setShowWarning }
}

export function getLastActivity() {
  return Number(localStorage.getItem(ACTIVITY_KEY)) || 0
}

export function isSessionExpired() {
  const last = getLastActivity()
  if (!last) return false
  return Date.now() - last > TIMEOUT_MS
}
