import { queryOptions } from '@tanstack/react-query'
import { getItems } from './api'

/**
 * Shared query definition for the catalog list.
 * Defining key + fn once keeps them in sync wherever the query is used
 * (useQuery, prefetching, invalidation).
 */
export const itemsQuery = queryOptions({
  queryKey: ['items'],
  // TanStack Query passes an AbortSignal; it cancels the request if
  // no component needs the result anymore.
  queryFn: ({ signal }) => getItems(signal),
  // Catalog only changes via CSV import, so 5 min before it's considered stale.
  staleTime: 5 * 60 * 1000,
})