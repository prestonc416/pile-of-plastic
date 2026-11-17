import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { checkPhotoFile, MAX_PHOTOS_PER_ENTRY, PHOTO_ACCEPT } from '../photos.ts'
import { useDeleteEntryPhoto, useUploadEntryPhoto } from '../queries.ts'
import type { CollectionEntry } from '../types.ts'

/** The owner's photos of one copy, with add and a two-step remove. */
export default function EntryPhotos({ entry, name }: { entry: CollectionEntry; name: string }) {
  const upload = useUploadEntryPhoto()
  const remove = useDeleteEntryPhoto()
  const [pickError, setPickError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const busy = upload.isPending || remove.isPending
  const canAdd = entry.photos.length < MAX_PHOTOS_PER_ENTRY

  function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // allow picking the same file again after an error
    if (file === undefined) return
    const problem = checkPhotoFile(file)
    setPickError(problem)
    remove.reset()
    if (problem === null) upload.mutate({ entryId: entry.id, file })
  }

  const error =
    pickError ??
    (upload.isError ? `Photo not added. ${upload.error.message}` : null) ??
    (remove.isError ? `Photo not removed. ${remove.error.message}` : null)

  return (
    <div className="entry-photos">
      {entry.photos.length > 0 && <span className="field-label">Your photos</span>}
      {entry.photos.length > 0 && (
        <ul className="photo-strip" aria-label={`Your photos of ${name}`}>
          {entry.photos.map((photo, index) => (
            <li key={photo.id} className="photo-tile">
              <a href={photo.url} target="_blank" rel="noopener noreferrer">
                <img
                  className="photo-tile-img"
                  src={photo.thumb_url}
                  alt={`Your photo ${index + 1} of ${name}`}
                  width={200}
                  height={200}
                  loading="lazy"
                  decoding="async"
                />
              </a>
              {confirmingId === photo.id ? (
                <div className="photo-confirm" role="group" aria-label="Remove this photo?">
                  <button
                    type="button"
                    className="button button-small button-danger-solid"
                    disabled={busy}
                    onClick={() =>
                      remove.mutate(
                        { entryId: entry.id, photoId: photo.id },
                        { onSuccess: () => setConfirmingId(null) },
                      )
                    }
                  >
                    {remove.isPending ? 'Removing…' : 'Remove'}
                  </button>
                  <button
                    type="button"
                    className="button button-small"
                    disabled={busy}
                    onClick={() => setConfirmingId(null)}
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="button button-small"
                  disabled={busy}
                  aria-label={`Remove your photo ${index + 1} of ${name}`}
                  onClick={() => {
                    remove.reset()
                    setConfirmingId(photo.id)
                  }}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canAdd && (
        <label className={busy ? 'button file-button is-disabled' : 'button file-button'}>
          {upload.isPending ? 'Uploading…' : 'Add photo'}
          <input
            type="file"
            className="visually-hidden"
            accept={PHOTO_ACCEPT}
            disabled={busy}
            aria-label={`Add a photo of your ${name}`}
            onChange={handlePick}
          />
        </label>
      )}
      {error !== null && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
