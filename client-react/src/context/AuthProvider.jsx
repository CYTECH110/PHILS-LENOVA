import { useCallback, useEffect, useState } from 'react'
import { AuthContext } from './auth-context.js'
import { api } from '../lib/api.js'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.getSession().then((session) => {
      if (!cancelled) {
        setUser(session)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => setUser(null)
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const updateUser = useCallback((next) => {
    setUser((current) => ({ ...(current || {}), ...next }))
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}