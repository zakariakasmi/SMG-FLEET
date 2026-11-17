import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../services/supabase'
import { usersApi } from '../services/api'
import { isSessionExpired } from '../hooks/useInactivityTimeout'
import { READ_ONLY_SCOPES } from '../constants/permissions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const appliedRef = useRef(null)

  const applyUserFromSession = useCallback(async (session) => {
    if (!session?.user) {
      setUser(null)
      return
    }
    const authId = session.user.id
    if (appliedRef.current === authId) return
    appliedRef.current = authId
    try {
      const profile = await usersApi.getByAuthId(authId)
      setUser(profile)
    } catch (e) {
      console.error('Failed to load user profile', e)
      setUser(null)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (isSessionExpired()) {
        localStorage.removeItem('lastActivity')
        await supabase.auth.signOut()
      } else if (data?.session) {
        await applyUserFromSession(data.session)
      }
      if (mounted) setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        applyUserFromSession(session)
      } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        appliedRef.current = null
        setUser(null)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [applyUserFromSession])

  const login = (userData) => {
    setUser(userData)
    localStorage.setItem('lastActivity', String(Date.now()))
  }

  const logout = useCallback(async () => {
    setUser(null)
    appliedRef.current = null
    localStorage.removeItem('user')
    localStorage.removeItem('session')
    localStorage.removeItem('lastActivity')
    await supabase.auth.signOut()
  }, [])

  const can = (scope) => {
    if (!user) return false
    if (user.role === 'admin') return true
    if (!scope) return true
    if (READ_ONLY_SCOPES.includes(scope)) return true
    const perms = Array.isArray(user.permissions) ? user.permissions : []
    if (scope === 'addCharges' || scope === 'editCharges' || scope === 'deleteCharges') {
      return perms.includes('charges') && perms.includes(scope)
    }
    return perms.includes(scope)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: !!user?.role && user.role === 'admin', permissions: user?.permissions || [], can }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}