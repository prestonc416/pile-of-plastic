import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { checkPhotoFile, MAX_PHOTOS_PER_ENTRY, PHOTO_ACCEPT } from '../photos.ts'
import { useDeleteEntryPhoto, useUploadEntryPhoto } from '../queries.ts'
import type { CollectionEntry } from '../types.ts'

/**
 * Controls for the user's own photos of one copy, used on the copy page
 * (EntryPage) next to the photo viewer.
 */

/**
 * "Add photo" button. Hidden once the copy has the maximum number of photos.
 * Checks the file before uploading, so a HEIC or oversized file gets an
 * instant message instead of a failed upload.
 */
export function AddEntryPhoto({ entry, name }: { entry: CollectionEntry; name: string }) {
  const upload = useUploadEntryPhoto()
  const [pickError, setPickError] = useState<string | null>(null)

  if (entry.photos.length >= MAX_PHOTOS_PER_ENTRY) {
    return <p className="field-hint">You have {MAX_PHOTOS_PER_ENTRY} photos of this copy, the most allowed.</p>
  }

  function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // allow picking the same file again after an error
    if (file === undefined) return
    const problem = checkPhotoFile(file)
    setPickError(problem)
    if (problem === null) upload.mutate({ entryId: entry.id, file })
  }

  const error = pickError ?? (upload.isError ? `Photo not added. ${upload.error.message}` : null)

  return (
    <div className="photo-add">
      <label className={upload.isPending ? 'button file-button is-disabled' : 'button file-button'}>
        {upload.isPending ? 'Uploading…' : 'Add a photo of your copy'}
        <input
          type="file"
          className="visually-hidden"
          accept={PHOTO_ACCEPT}
          disabled={upload.isPending}
          aria-label={`Add a photo of your ${name}`}
          aria-describedby="add-photo-hint"
          onChange={handlePick}
        />
      </label>
      <p className="field-hint" id="add-photo-hint">
        Up to {MAX_PHOTOS_PER_ENTRY} JPG, PNG, or WebP photos, 10 MB each. Only you see these.
      </p>
      {error !== null && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Two-step remove for one of the user's photos: "Remove this photo", then
 * confirm. Give it `key={photoId}` so the confirm step resets when the
 * viewer moves to another photo.
 */
export function RemoveEntryPhoto({ entryId, photoId }: { entryId: number; photoId: number }) {
  const remove = useDeleteEntryPhoto()
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button type="button" className="button button-small" onClick={() => setConfirming(true)}>
        Remove this photo
      </button>
    )
  }
  return (
    <div className="photo-confirm" role="group" aria-label="Remove this photo?">
      <span>Remove this photo?</span>
      <button
        type="button"
        className="button button-small button-danger-solid"
        disabled={remove.isPending}
        // The button that had focus just disappeared, so move focus here.
        autoFocus
        onClick={() => remove.mutate({ entryId, photoId })}
      >
        {remove.isPending ? 'Removing…' : 'Remove'}
      </button>
      <button
        type="button"
        className="button button-small"
        disabled={remove.isPending}
        onClick={() => {
          remove.reset()
          setConfirming(false)
        }}
      >
        Keep
      </button>
      {remove.isError && (
        <p className="field-error" role="alert">
          Photo not removed. {remove.error.message}
        </p>
      )}
    </div>
  )
}
