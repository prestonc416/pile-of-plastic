import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import EntryForm from '../components/EntryForm.tsx'
import { AddEntryPhoto, RemoveEntryPhoto } from '../components/EntryPhotos.tsx'
import PhotoViewer from '../components/PhotoViewer.tsx'
import type { ViewerPhoto } from '../components/PhotoViewer.tsx'
import { formatDay, formatMoney } from '../format.ts'
import { imageUrl } from '../images.ts'
import { collectionQuery, useDeleteEntry, useUpdateEntry } from '../queries.ts'
import type { CollectionEntry } from '../types.ts'

/** Your own photos first, then the catalog's photos of the figure. */
function viewerPhotos(entry: CollectionEntry, name: string): ViewerPhoto[] {
  const own = entry.photos.map((photo, i) => ({
    id: `own-${photo.id}`,
    src: photo.url,
    thumbSrc: photo.thumb_url,
    alt: `Your photo ${i + 1} of your ${name}`,
    label: 'Your photo',
    ownPhotoId: photo.id,
  }))
  const catalog = entry.item.images.map((image) => ({
    id: `catalog-${image.position}`,
    src: imageUrl(image.path),
    thumbSrc: imageUrl(image.thumb_path),
    alt: image.alt_text,
    label: 'Catalog photo',
  }))
  return [...own, ...catalog]
}

/** True when the page was opened with "Edit" from the collection card menu. */
function openedForEditing(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'edit' in state && state.edit === true
}

/**
 * One copy in the user's collection: photos (add and remove your own), the
 * catalog description, what the user recorded, an editor for the price,
 * date, and notes, and a way to remove the copy. Wrapped in RequireAuth by App.
 */
export default function EntryPage() {
  const { entryId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  // Reuses the collection already in the cache, so opening a copy from the
  // collection page is instant and stays in sync after edits.
  const collection = useQuery(collectionQuery)
  const updateEntry = useUpdateEntry()
  const deleteEntry = useDeleteEntry()
  const [editing, setEditing] = useState(() => openedForEditing(location.state))
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const editHeadingRef = useRef<HTMLHeadingElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusToEdit = useRef(false)

  const entry = collection.data?.find((e) => String(e.id) === entryId)
  const hasEntry = entry !== undefined

  // Move keyboard focus when the editor opens or closes. In an effect (not
  // on every render), so a background refetch never pulls focus away.
  useEffect(() => {
    if (!hasEntry) return
    if (editing) {
      editHeadingRef.current?.focus()
    } else if (returnFocusToEdit.current) {
      returnFocusToEdit.current = false
      editButtonRef.current?.focus()
    }
  }, [editing, hasEntry])

  function closeEditor() {
    updateEntry.reset()
    returnFocusToEdit.current = true
    setEditing(false)
    // Forget "opened for editing", so Back and Forward don't reopen the editor.
    if (openedForEditing(location.state)) void navigate(location.pathname, { replace: true, state: null })
  }

  if (collection.isPending) return <p className="status">Loading…</p>
  if (collection.isError) {
    return (
      <p className="status status-error" role="alert">
        Your collection did not load. {collection.error.message}
      </p>
    )
  }
  // Just removed: the collection refetches before the redirect finishes.
  if (deleteEntry.isSuccess) return null

  if (entry === undefined) {
    return (
      <div className="empty">
        <p role="alert">That copy isn't in your collection.</p>
        <Link to="/collection" className="button">
          Back to my collection
        </Link>
      </div>
    )
  }

  const name = entry.item.figure.trim()
  const price = entry.bought_for !== null ? formatMoney(entry.bought_for) : null
  const photos = viewerPhotos(entry, name)

  return (
    <div className="narrow">
      <p className="back-link">
        <Link to="/collection">Back to my collection</Link>
      </p>
      <div className="page-head">
        <h1>{name}</h1>
        {editing ? (
          <section className="panel edit-panel" aria-labelledby="edit-heading">
            <h2 id="edit-heading" tabIndex={-1} ref={editHeadingRef}>
              Edit this copy
            </h2>
            <EntryForm
              initial={entry}
              submitLabel="Save changes"
              pendingLabel="Saving…"
              isPending={updateEntry.isPending}
              error={updateEntry.isError ? updateEntry.error.message : null}
              onSubmit={(fields) => updateEntry.mutate({ id: entry.id, fields }, { onSuccess: closeEditor })}
              onCancel={closeEditor}
            />
          </section>
        ) : (
          <>
            <dl className="facts">
              {entry.item.line && (
                <div>
                  <dt>Line</dt>
                  <dd>{entry.item.line}</dd>
                </div>
              )}
              {entry.item.brand && (
                <div>
                  <dt>Brand</dt>
                  <dd>{entry.item.brand}</dd>
                </div>
              )}
              <div>
                <dt>You paid</dt>
                <dd>{price ?? 'Not recorded'}</dd>
              </div>
              <div>
                <dt>You got it</dt>
                <dd>{entry.acquired_at ? formatDay(entry.acquired_at) : 'Not recorded'}</dd>
              </div>
            </dl>
            <button
              ref={editButtonRef}
              type="button"
              className="button edit-button"
              onClick={() => setEditing(true)}
            >
              Edit price, date, or notes
            </button>
          </>
        )}
      </div>

      <section className="entry-section" aria-label="Photos">
        {photos.length > 0 ? (
          <PhotoViewer
            photos={photos}
            title={name}
            renderActions={(photo) =>
              photo.ownPhotoId !== undefined ? (
                // key: the confirm step resets when the viewer moves to another photo.
                <RemoveEntryPhoto key={photo.ownPhotoId} entryId={entry.id} photoId={photo.ownPhotoId} />
              ) : null
            }
          />
        ) : (
          <p className="muted viewer-empty">No photos yet.</p>
        )}
        <AddEntryPhoto entry={entry} name={name} />
      </section>

      {entry.item.description && <p className="description">{entry.item.description}</p>}

      {/* While editing, the notes are in the form above. */}
      {entry.notes && !editing && (
        <section className="entry-section" aria-labelledby="notes-heading">
          <h2 id="notes-heading">Your notes</h2>
          <p className="entry-notes">{entry.notes}</p>
        </section>
      )}

      <section className="entry-section remove-section" aria-label="Remove this copy">
        {confirmingRemove ? (
          <div className="confirm" role="group" aria-label={`Remove ${name}?`}>
            <p>Remove this copy from your collection? Its photos are deleted too. This cannot be undone.</p>
            {deleteEntry.isError && (
              <p className="form-error" role="alert">
                Not removed. {deleteEntry.error.message}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button button-danger-solid"
                disabled={deleteEntry.isPending}
                autoFocus
                onClick={() =>
                  deleteEntry.mutate(entry.id, {
                    onSuccess: () => void navigate('/collection', { replace: true }),
                  })
                }
              >
                {deleteEntry.isPending ? 'Removing…' : 'Remove'}
              </button>
              <button
                type="button"
                className="button"
                disabled={deleteEntry.isPending}
                onClick={() => {
                  deleteEntry.reset()
                  setConfirmingRemove(false)
                }}
              >
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="button button-danger" onClick={() => setConfirmingRemove(true)}>
            Remove from my collection
          </button>
        )}
      </section>

      <p className="muted">
        See every version of this figure in <Link to={`/items/${entry.item.slug}`}>the catalog</Link>.
      </p>
    </div>
  )
}
