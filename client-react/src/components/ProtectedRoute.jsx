import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { ROLE_HOMES } from '../context/auth-context.js'

export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (role && String(user.role).toUpperCase() !== role) {
    const home = ROLE_HOMES[String(user.role || '').toUpperCase()]
    return <Navigate to={home || '/login'} replace />
  }

  return children
}