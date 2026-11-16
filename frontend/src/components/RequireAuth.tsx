import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuthToken } from '../authStore.ts'

/**
 * Renders `children` only while logged in. Otherwise redirects to /login and
 * remembers the page that was asked for, so login can send the user back.
 *
 * This is a convenience for the user, not security: the API is what actually
 * enforces access, by rejecting requests without a valid token.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthToken()
  const location = useLocation()

  if (token === null) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
