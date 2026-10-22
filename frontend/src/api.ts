import type { Item } from './types'

/** API base URL. Override with VITE_API_URL in frontend/.env files. */
const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** Thrown for any non-2xx response, carrying the HTTP status. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Fetch the full catalog.
 * @param signal Optional AbortSignal so callers can cancel the request.
 * @throws ApiError on non-2xx; TypeError on network failure; AbortError if aborted.
 */
export async function getItems(signal?: AbortSignal): Promise<Item[]> {
  // Trailing slash matches the FastAPI route exactly, avoiding a redirect.
  const res = await fetch(`${API_URL}/items/`, { signal })
  if (!res.ok) {
    throw new ApiError(res.status, `GET /items/ failed: ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Item[]
}