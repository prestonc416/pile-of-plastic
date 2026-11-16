/**
 * In-memory access token store.
 *
 * The token is never written to localStorage, sessionStorage, or a cookie,
 * so a script injected into the page cannot read a persisted copy. The cost:
 * refreshing the page clears it and the user has to log in again.
 *
 * It lives outside React so the fetch helpers in api.ts can read it.
 * Components subscribe through useAuthToken().
 */
import { useSyncExternalStore } from 'react'

type Listener = () => void

let token: string | null = null
const listeners = new Set<Listener>()

/** The current token, or null when logged out. */
export function getToken(): string | null {
  return token
}

/** Set the token (log in) or clear it (log out, or a 401), then notify subscribers. */
export function setToken(next: string | null): void {
  if (next === token) return
  token = next
  listeners.forEach((listener) => listener())
}

/**
 * Call `listener` whenever the token changes.
 * @returns a function that removes the listener, so nothing is left behind.
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The current token. Re-renders the calling component when it changes. */
export function useAuthToken(): string | null {
  return useSyncExternalStore(subscribe, getToken)
}
