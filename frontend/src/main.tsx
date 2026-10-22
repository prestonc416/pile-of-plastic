import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ApiError } from './api.ts'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
