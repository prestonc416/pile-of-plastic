/**
 * Shared TanStack Query definitions. Defining each key + fetch function once
 * keeps them in sync everywhere the query is read or invalidated.
 */
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  addEntry,
  deleteEntry,
  deleteEntryPhoto,
  getCollection,
  getItem,
  getItems,
  getMe,
  updateEntry,
  uploadEntryPhoto,
} from './api.ts'
import type { CollectionEntry, EntryFields, NewEntry } from './types.ts'

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

/** A photo that was picked but did not upload, with the reason. */
export interface FailedUpload {
  fileName: string
  message: string
}

/**
 * Add an item to the collection, then upload any photos picked for it.
 * The entry is kept even if a photo fails: the result lists the failures,
 * and the user can retry from their collection.
 */
export function useAddEntryWithPhotos() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ entry, photos }: { entry: NewEntry; photos: File[] }) => {
      const created: CollectionEntry = await addEntry(entry)
      const failed: FailedUpload[] = []
      // One at a time, so the server's 2-photo limit is applied in order.
      for (const file of photos) {
        try {
          await uploadEntryPhoto(created.id, file)
        } catch (err) {
          failed.push({ fileName: file.name, message: err instanceof Error ? err.message : 'Upload failed' })
        }
      }
      return { created, failed }
    },
    // onSettled: refetch even if something failed part way, since the entry
    // (and maybe some photos) may already exist.
    onSettled: () => queryClient.invalidateQueries({ queryKey: collectionQuery.queryKey }),
  })
}

/** Attach one photo to an existing entry, then refetch the collection. */
export function useUploadEntryPhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ entryId, file }: { entryId: number; file: File }) => uploadEntryPhoto(entryId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectionQuery.queryKey }),
  })
}

/** Remove one photo from an entry, then refetch the collection. */
export function useDeleteEntryPhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ entryId, photoId }: { entryId: number; photoId: number }) =>
      deleteEntryPhoto(entryId, photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectionQuery.queryKey }),
  })
}
