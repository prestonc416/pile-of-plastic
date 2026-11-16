import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ApiError } from './api.ts'
import { getToken, subscribe } from './authStore.ts'
import { USER_SCOPED_KEYS } from './queries.ts'
import App from './App.tsx'
import './index.css'

/**
 * Created once at module level, never inside a component, so the cache
 * isn't recreated on re-render.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry network errors and 5xx up to 3 times; 4xx won't fix itself.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 3,
    },
  },
})

/**
 * On logout (or a 401), drop everything that belonged to that user. Without
 * this, the previous user's collection would stay cached in memory and could
 * flash on screen for whoever logs in next on this browser.
 *
 * Subscribed once for the lifetime of the page, so there is nothing to clean up.
 */
subscribe(() => {
  if (getToken() !== null) return
  for (const queryKey of USER_SCOPED_KEYS) {
    void queryClient.cancelQueries({ queryKey })
    queryClient.removeQueries({ queryKey })
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
