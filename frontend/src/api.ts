/**
 * Typed client for the FastAPI backend. Every network call goes through
 * request(), so auth headers and error handling live in one place.
 */
import { getToken, setToken } from './authStore.ts'
import type {
  CollectionEntry,
  Credentials,
  EntryFields,
  Item,
  NewEntry,
  Token,
  User,
} from './types.ts'

/** API base URL. Override with VITE_API_URL in frontend/.env files. */
const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** Thrown for any non-2xx response. `message` is safe to show to the user. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Pull a readable message out of a FastAPI error body.
 * HTTPException sends {"detail": "text"}; a 422 validation error sends
 * {"detail": [{"msg": "text", ...}, ...]}.
 */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json()
    if (typeof body === 'object' && body !== null && 'detail' in body) {
      const detail = body.detail
      if (typeof detail === 'string') return detail
      if (Array.isArray(detail)) {
        const messages = detail.flatMap((part: unknown) =>
          typeof part === 'object' && part !== null && 'msg' in part && typeof part.msg === 'string'
            ? [part.msg]
            : [],
        )
        if (messages.length > 0) return messages.join('. ')
      }
    }
  } catch {
    // Body was empty or not JSON; fall through to the generic message.
  }
  return `Request failed (${res.status} ${res.statusText})`
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** Sent as JSON when provided. */
  body?: unknown
  /** Lets the caller (TanStack Query) cancel the request. */
  signal?: AbortSignal
}

/**
 * Fetch wrapper.
 * - Attaches the bearer token when one is set.
 * - On a 401 for a request that carried a token (expired or invalid), clears
 *   the token, which logs the user out everywhere.
 * @throws ApiError on a non-2xx response; Error if the server is unreachable;
 *         the original AbortError if `signal` was aborted.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options
  const headers = new Headers()
  const token = getToken()
  if (token !== null) headers.set('Authorization', `Bearer ${token}`)
  if (body !== undefined) headers.set('Content-Type', 'application/json')

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    // A cancelled request is not a failure; let the caller see the abort.
    if (signal?.aborted) throw err
    throw new Error('Could not reach the server. Check that the API is running.', { cause: err })
  }

  if (!res.ok) {
    // A failed login is also a 401, but it carried no token, so it is skipped.
    // The identity check avoids wiping a newer token from a login that
    // finished while this request was in flight.
    if (res.status === 401 && token !== null && getToken() === token) setToken(null)
    throw new ApiError(res.status, await errorMessage(res))
  }

  // DELETE returns 204 No Content: there is no body to parse.
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// --- Catalog (public) ---

/** Every item in the catalog, ordered by figure name. */
export function getItems(signal?: AbortSignal): Promise<Item[]> {
  // Trailing slash matches the FastAPI route exactly, avoiding a redirect.
  return request<Item[]>('/items/', { signal })
}

/** One catalog item. Rejects with a 404 ApiError if the slug is unknown. */
export function getItem(slug: string, signal?: AbortSignal): Promise<Item> {
  return request<Item>(`/items/${encodeURIComponent(slug)}`, { signal })
}

// --- Auth ---

/** Create an account. Rejects with a 409 ApiError if the email is taken. */
export function register(credentials: Credentials): Promise<User> {
  return request<User>('/auth/register', { method: 'POST', body: credentials })
}

/** Exchange email + password for a token. Rejects with 401 on bad credentials. */
export function login(credentials: Credentials): Promise<Token> {
  return request<Token>('/auth/login', { method: 'POST', body: credentials })
}

/** The logged-in user. Requires a token. */
export function getMe(signal?: AbortSignal): Promise<User> {
  return request<User>('/auth/me', { signal })
}

// --- Collection (requires a token, scoped to the current user) ---

/** The current user's entries, newest first. */
export function getCollection(signal?: AbortSignal): Promise<CollectionEntry[]> {
  return request<CollectionEntry[]>('/collection/', { signal })
}

/** Add a catalog item to the current user's collection. */
export function addEntry(entry: NewEntry): Promise<CollectionEntry> {
  return request<CollectionEntry>('/collection/', { method: 'POST', body: entry })
}

/** Update an entry. Fields sent as null are cleared; omitted fields are kept. */
export function updateEntry(id: number, fields: Partial<EntryFields>): Promise<CollectionEntry> {
  return request<CollectionEntry>(`/collection/${id}`, { method: 'PATCH', body: fields })
}

/** Remove an entry from the current user's collection. */
export function deleteEntry(id: number): Promise<void> {
  return request<void>(`/collection/${id}`, { method: 'DELETE' })
}
