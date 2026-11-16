/**
 * Shared TanStack Query definitions. Defining each key + fetch function once
 * keeps them in sync everywhere the query is read or invalidated.
 */
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { addEntry, deleteEntry, getCollection, getItem, getItems, getMe, updateEntry } from './api.ts'
import type { EntryFields } from './types.ts'

/** The catalog only changes via CSV import, so cache it for 5 minutes. */
const CATALOG_STALE_MS = 5 * 60 * 1000

/** Every catalog item. */
export const itemsQuery = queryOptions({
  queryKey: ['items'],
  // TanStack Query passes an AbortSignal and cancels the request if no
  // component needs the result anymore.
  queryFn: ({ signal }) => getItems(signal),
  staleTime: CATALOG_STALE_MS,
})

/** One catalog item by slug. */
export function itemQuery(slug: string) {
  return queryOptions({
    queryKey: ['items', slug],
    queryFn: ({ signal }) => getItem(slug, signal),
    staleTime: CATALOG_STALE_MS,
  })
}

/**
 * Keys for data that belongs to the logged-in user. main.tsx removes these
 * from the cache on logout so the next user never sees them.
 */
export const USER_SCOPED_KEYS = [['collection'], ['me']] as const

/** The current user's collection. Only enable this while logged in. */
export const collectionQuery = queryOptions({
  queryKey: ['collection'],
  queryFn: ({ signal }) => getCollection(signal),
})

/** The current user's account. Only enable this while logged in. */
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: ({ signal }) => getMe(signal),
  staleTime: Infinity, // email does not change during a session
})

/** Add an item to the collection, then refetch the collection. */
export function useAddEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectionQuery.queryKey }),
  })
}

/** Edit an entry's price, date, or notes, then refetch the collection. */
export function useUpdateEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: number; fields: Partial<EntryFields> }) =>
      updateEntry(id, fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectionQuery.queryKey }),
  })
}

/** Remove an entry, then refetch the collection. */
export function useDeleteEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectionQuery.queryKey }),
  })
}
