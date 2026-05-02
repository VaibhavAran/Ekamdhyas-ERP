import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { readAuthFlag } from '../utils/authStorage'

export function ProtectedRoute({ children }: PropsWithChildren) {
  const location = useLocation()
  const isAuthenticated = readAuthFlag()

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return children
}