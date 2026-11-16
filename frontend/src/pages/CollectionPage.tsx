import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import EntryForm from '../components/EntryForm.tsx'
import Thumbnail from '../components/Thumbnail.tsx'
import { formatCents, formatDay, formatMoney, toCents } from '../format.ts'
import { collectionQuery, useDeleteEntry, useUpdateEntry } from '../queries.ts'
import type { CollectionEntry } from '../types.ts'

/** What an entry card is currently showing. */
type CardMode = 'view' | 'edit' | 'confirm-remove'

/** One owned figure: details, with inline edit and a two-step remove. */
function EntryCard({ entry }: { entry: CollectionEntry }) {
  const [mode, setMode] = useState<CardMode>('view')
  const updateEntry = useUpdateEntry()
  const deleteEntry = useDeleteEntry()
  const price = entry.bought_for !== null ? formatMoney(entry.bought_for) : null
  const name = entry.item.figure.trim()

  return (
    <li className="entry">
      <div className="entry-head">
        <Thumbnail item={entry.item} />
        <div className="entry-title">
          <Link to={`/items/${entry.item.slug}`} className="row-name">
            {name}
          </Link>
          <span className="row-meta">
            {[entry.item.line, entry.item.brand].filter((part) => part !== null).join(', ')}
          </span>
        </div>
        {price !== null ? (
          <span className="sticker">{price}</span>
        ) : (
          <span className="muted">No price recorded</span>
        )}
      </div>

      {mode === 'edit' ? (
        <EntryForm
          initial={entry}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          isPending={updateEntry.isPending}
          error={updateEntry.isError ? updateEntry.error.message : null}
          onSubmit={(fields) =>
            updateEntry.mutate({ id: entry.id, fields }, { onSuccess: () => setMode('view') })
          }
          onCancel={() => {
            updateEntry.reset()
            setMode('view')
          }}
        />
      ) : (
        <>
          <p className="entry-detail">
            {entry.acquired_at ? `Got it ${formatDay(entry.acquired_at)}` : 'No date recorded'}
          </p>
          {entry.notes && <p className="entry-notes">{entry.notes}</p>}

          {mode === 'view' ? (
            <div className="form-actions">
              <button type="button" className="button" aria-label={`Edit ${name}`} onClick={() => setMode('edit')}>
                Edit
              </button>
              <button
                type="button"
                className="button button-danger"
                aria-label={`Remove ${name}`}
                onClick={() => setMode('confirm-remove')}
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="confirm" role="group" aria-label={`Remove ${name}?`}>
              <p>Remove this copy from your collection? This cannot be undone.</p>
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
                  onClick={() => deleteEntry.mutate(entry.id)}
                >
                  {deleteEntry.isPending ? 'Removing…' : 'Remove'}
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={deleteEntry.isPending}
                  onClick={() => {
                    deleteEntry.reset()
                    setMode('view')
                  }}
                >
                  Keep it
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </li>
  )
}

/** Count and total spent. Entries with no price are left out of the total. */
function Summary({ entries }: { entries: CollectionEntry[] }) {
  let totalCents = 0
  let pricedCount = 0
  for (const entry of entries) {
    const cents = entry.bought_for !== null ? toCents(entry.bought_for) : null
    if (cents !== null) {
      totalCents += cents
      pricedCount += 1
    }
  }
  const unpriced = entries.length - pricedCount

  return (
    <p className="page-lede">
      {entries.length} {entries.length === 1 ? 'figure' : 'figures'}.{' '}
      {pricedCount > 0 && <>{formatCents(totalCents)} spent</>}
      {pricedCount > 0 && unpriced > 0 && <>, not counting {unpriced} with no price recorded</>}
      {pricedCount > 0 && '.'}
    </p>
  )
}

/** The logged-in user's collection, newest first. Wrapped in RequireAuth by App. */
export default function CollectionPage() {
  const collection = useQuery(collectionQuery)

  if (collection.isPending) return <p className="status">Loading your collection…</p>
  if (collection.isError) {
    return (
      <p className="status status-error" role="alert">
        Your collection did not load. {collection.error.message}
      </p>
    )
  }

  return (
    <div className="narrow">
      <div className="page-head">
        <h1>My collection</h1>
        {collection.data.length > 0 && <Summary entries={collection.data} />}
      </div>

      {collection.data.length === 0 ? (
        <div className="empty">
          <p>Your collection is empty. Find a figure you own in the catalog and add it.</p>
          <Link to="/" className="button button-primary">
            Browse the catalog
          </Link>
        </div>
      ) : (
        <ul className="entries">
          {collection.data.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  )
}
