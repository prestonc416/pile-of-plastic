import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api.ts'
import { useAuthToken } from '../authStore.ts'
import EntryForm from '../components/EntryForm.tsx'
import Gallery from '../components/Gallery.tsx'
import { formatDay, formatMoney } from '../format.ts'
import Thumbnail from '../components/Thumbnail.tsx'
import { collectionQuery, itemQuery, useAddEntryWithPhotos } from '../queries.ts'
import type { Item } from '../types.ts'

/** Add form plus the copies of this item the user already owns. */
function OwnedCopies({ item }: { item: Item }) {
  const collection = useQuery(collectionQuery)
  const addEntry = useAddEntryWithPhotos()
  // Bumped after each successful add; changing the form's key resets its inputs.
  const [addedCount, setAddedCount] = useState(0)

  const copies = (collection.data ?? []).filter((entry) => entry.item.id === item.id)

  return (
    <>
      <section className="panel" aria-labelledby="add-heading">
        <h2 id="add-heading">Add to my collection</h2>
        <EntryForm
          key={addedCount}
          submitLabel="Add to collection"
          pendingLabel="Adding…"
          isPending={addEntry.isPending}
          error={addEntry.isError ? addEntry.error.message : null}
          withPhotos
          onSubmit={(fields, photos) =>
            addEntry.mutate(
              { entry: { item_id: item.id, ...fields }, photos },
              { onSuccess: () => setAddedCount((count) => count + 1) },
            )
          }
        />
        {addEntry.isSuccess && addEntry.data.failed.length === 0 && (
          <p className="form-success" role="status">
            Added to your collection.
          </p>
        )}
        {addEntry.isSuccess && addEntry.data.failed.length > 0 && (
          <div className="form-error" role="alert">
            <p>Added to your collection, but {addEntry.data.failed.length === 1 ? 'a photo' : 'some photos'} didn't upload:</p>
            <ul>
              {addEntry.data.failed.map((failure, index) => (
                <li key={`${index}-${failure.fileName}`}>
                  {failure.fileName}: {failure.message}
                </li>
              ))}
            </ul>
            <p>
              You can add photos from <Link to="/collection">your collection</Link>.
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="copies-heading">
        <h2 id="copies-heading">Copies you own</h2>
        {collection.isPending && <p className="status">Loading your collection…</p>}
        {collection.isError && (
          <p className="status status-error" role="alert">
            Your collection did not load. {collection.error.message}
          </p>
        )}
        {collection.isSuccess && copies.length === 0 && (
          <p className="muted">None yet. Use the form above to log one.</p>
        )}
        {copies.length > 0 && (
          <>
            <ul className="rows">
              {copies.map((entry) => (
                <li key={entry.id} className="row">
                  {entry.photos[0] !== undefined && <Thumbnail item={item} ownPhoto={entry.photos[0]} />}
                  <div className="row-main">
                    <span>{entry.acquired_at ? `Got it ${formatDay(entry.acquired_at)}` : 'No date recorded'}</span>
                    {entry.notes && <span className="row-meta">{entry.notes}</span>}
                  </div>
                  <div className="row-actions">
                    {entry.bought_for !== null && (
                      <span className="sticker sticker-small">{formatMoney(entry.bought_for)}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="muted">
              Edit or remove copies in <Link to="/collection">your collection</Link>.
            </p>
          </>
        )}
      </section>
    </>
  )
}

/** One catalog item: its details, and for logged-in users, their copies of it. */
export default function ItemPage() {
  const { slug = '' } = useParams()
  const isLoggedIn = useAuthToken() !== null
  const item = useQuery(itemQuery(slug))

  if (item.isPending) return <p className="status">Loading…</p>
  if (item.isError) {
    const notFound = item.error instanceof ApiError && item.error.status === 404
    return (
      <div className="empty">
        <p role="alert">{notFound ? 'That figure is not in the catalog.' : `This figure did not load. ${item.error.message}`}</p>
        <Link to="/" className="button">
          Back to the catalog
        </Link>
      </div>
    )
  }

  const catalogPrice = item.data.current_price !== null ? formatMoney(item.data.current_price) : null

  return (
    <div className="narrow">
      <p className="back-link">
        <Link to="/">Back to the catalog</Link>
      </p>
      <div className="page-head">
        <h1>{item.data.figure.trim()}</h1>
        <dl className="facts">
          {item.data.line && (
            <div>
              <dt>Line</dt>
              <dd>{item.data.line}</dd>
            </div>
          )}
          {item.data.brand && (
            <div>
              <dt>Brand</dt>
              <dd>{item.data.brand}</dd>
            </div>
          )}
          {catalogPrice !== null && (
            <div>
              <dt>Current price</dt>
              <dd>{catalogPrice}</dd>
            </div>
          )}
        </dl>
      </div>

      <Gallery images={item.data.images} />
      {item.data.description && <p className="description">{item.data.description}</p>}

      {isLoggedIn ? (
        <OwnedCopies item={item.data} />
      ) : (
        <div className="panel">
          <p>
            <Link to="/login" state={{ from: `/items/${item.data.slug}` }}>
              Log in
            </Link>{' '}
            to add this figure to your collection.
          </p>
        </div>
      )}
    </div>
  )
}
