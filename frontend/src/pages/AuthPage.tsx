import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { login, register } from '../api.ts'
import { setToken, useAuthToken } from '../authStore.ts'
import type { Credentials } from '../types.ts'

/** Matches min_length=8 / max_length=128 on the password in the backend schema. */
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 128

/** Where to go after logging in: the page that sent the user here, if any. */
function destinationFrom(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state && typeof state.from === 'string') {
    return state.from
  }
  return '/collection'
}

/**
 * Log in, or create an account and log straight in.
 * The two pages share one form; `mode` picks the wording and the request.
 */
export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const token = useAuthToken()
  const navigate = useNavigate()
  const location = useLocation()
  const destination = destinationFrom(location.state)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = useMutation({
    mutationFn: async (credentials: Credentials) => {
      // Registering does not return a token, so log in right after.
      if (isRegister) await register(credentials)
      return login(credentials)
    },
    onSuccess: (result) => {
      setToken(result.access_token)
      void navigate(destination, { replace: true })
    },
  })

  // Already logged in (or just finished): this page has nothing to offer.
  if (token !== null) return <Navigate to={destination} replace />

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submit.mutate({ email: email.trim(), password })
  }

  return (
    <div className="auth">
      <h1>{isRegister ? 'Create an account' : 'Log in'}</h1>
      <form className="panel" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            // Length rules are only shown when creating a password. On login,
            // every wrong password should get the same generic error.
            minLength={isRegister ? PASSWORD_MIN_LENGTH : undefined}
            maxLength={PASSWORD_MAX_LENGTH}
            aria-describedby={isRegister ? 'auth-password-hint' : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {isRegister && (
            <p className="field-hint" id="auth-password-hint">
              At least {PASSWORD_MIN_LENGTH} characters.
            </p>
          )}
        </div>
        {submit.isError && (
          <p className="form-error" role="alert">
            {submit.error.message}
          </p>
        )}
        <button type="submit" className="button button-primary" disabled={submit.isPending}>
          {submit.isPending
            ? isRegister
              ? 'Creating account…'
              : 'Logging in…'
            : isRegister
              ? 'Create account'
              : 'Log in'}
        </button>
      </form>
      <p className="muted">
        {isRegister ? (
          <>
            Already have an account?{' '}
            <Link to="/login" state={location.state}>
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link to="/register" state={location.state}>
              Create an account
            </Link>
          </>
        )}
      </p>
      <p className="muted">You stay logged in until you refresh or close this tab.</p>
    </div>
  )
}
