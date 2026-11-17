import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import CardMenu from '../components/CardMenu.tsx'
import Thumbnail from '../components/Thumbnail.tsx'
import { formatCents, formatDay, formatMoney, toCents } from '../format.ts'
import { collectionQuery, useDeleteEntry } from '../queries.ts'
import type { CollectionEntry } from '../types.ts'

/**
 * One owned figure as a compact card: photo, name, price, and date.
 * The three-dot menu offers Edit (opens the copy page with the editor open)
 * and Remove (asks to confirm here on the card).
 */
function EntryCard({ entry }: { entry: CollectionEntry }) {
  const navigate = useNavigate()
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const deleteEntry = useDeleteEntry()
  const price = entry.bought_for !== null ? formatMoney(entry.bought_for) : null
  const name = entry.item.figure.trim()
  const copyUrl = `/collection/${entry.id}`

  return (
    <li className="entry">
      <div className="entry-head">
        <Thumbnail item={entry.item} ownPhoto={entry.photos[0]} />
        <div className="entry-title">
          <Link to={copyUrl} className="row-name">
            {name}
          </Link>
          <span className="row-meta">
            {[entry.item.line, entry.item.brand].filter((part) => part !== null).join(', ')}
          </span>
          <span className="row-meta">
            {entry.acquired_at ? `Got it ${formatDay(entry.acquired_at)}` : 'No date recorded'}
          </span>
        </div>
        {price !== null ? (
          <span className="sticker">{price}</span>
        ) : (
          <span className="muted entry-no-price">No price recorded</span>
        )}
        <CardMenu
          label={`More actions for ${name}`}
          items={[
            { label: 'Edit', onSelect: () => void navigate(copyUrl, { state: { edit: true } }) },
            { label: 'Remove', danger: true, onSelect: () => setConfirmingRemove(true) },
          ]}
        />
      </div>

      {confirmingRemove && (
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
              // The menu that opened this just closed, so move focus here.
              autoFocus
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
                setConfirmingRemove(false)
              }}
            >
              Keep it
            </button>
          </div>
        </div>
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
