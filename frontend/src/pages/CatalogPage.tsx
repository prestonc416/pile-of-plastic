import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useAuthToken } from '../authStore.ts'
import BrandPicker from '../components/BrandPicker.tsx'
import type { BrandOption } from '../components/BrandPicker.tsx'
import Thumbnail from '../components/Thumbnail.tsx'
import { collectionQuery, itemsQuery, useAddEntry } from '../queries.ts'
import type { Item } from '../types.ts'

/** Heading for catalog items that have no line recorded. */
const NO_LINE = 'Other figures'

/** One-click add: logs a copy with no price or date; details can be added later. */
function QuickAdd({ item }: { item: Item }) {
  const addEntry = useAddEntry()
  return (
    <>
      {addEntry.isError && (
        <span className="row-error" role="alert">
          Not added: {addEntry.error.message}
        </span>
      )}
      <button
        type="button"
        className="button"
        disabled={addEntry.isPending}
        aria-label={`Add ${item.figure.trim()} to my collection`}
        onClick={() => addEntry.mutate({ item_id: item.id })}
      >
        {addEntry.isPending ? 'Adding…' : 'Add'}
      </button>
    </>
  )
}

/** Does the item match the search text (already lowercased)? */
function matchesSearch(item: Item, needle: string): boolean {
  return [item.figure, item.line, item.brand].some(
    (text) => text !== null && text.toLowerCase().includes(needle),
  )
}

/** Group items by line, lines in alphabetical order. Items keep the API's order. */
function groupByLine(items: Item[]): [string, Item[]][] {
  const groups = new Map<string, Item[]>()
  for (const item of items) {
    const line = item.line ?? NO_LINE
    const group = groups.get(line)
    if (group) group.push(item)
    else groups.set(line, [item])
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b))
}

/** The whole catalog, searchable, grouped by line. Logged-in users can add figures. */
export default function CatalogPage() {
  const isLoggedIn = useAuthToken() !== null
  const items = useQuery(itemsQuery)
  const collection = useQuery({ ...collectionQuery, enabled: isLoggedIn })
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('')

  if (items.isPending) return <p className="status">Loading the catalog…</p>
  if (items.isError) {
    return (
      <p className="status status-error" role="alert">
        The catalog did not load. {items.error.message}
      </p>
    )
  }

  // How many copies of each item the user owns, keyed by item id.
  const ownedCounts = new Map<number, number>()
  for (const entry of collection.data ?? []) {
    ownedCounts.set(entry.item.id, (ownedCounts.get(entry.item.id) ?? 0) + 1)
  }

  // Every brand with its figure count, alphabetical. Counts cover the whole
  // catalog, so they don't change while the user types a search.
  const brandCounts = new Map<string, number>()
  for (const item of items.data) {
    if (item.brand) brandCounts.set(item.brand, (brandCounts.get(item.brand) ?? 0) + 1)
  }
  const brands: BrandOption[] = [...brandCounts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const needle = search.trim().toLowerCase()
  const visible = items.data.filter(
    (item) => (brand === '' || item.brand === brand) && (needle === '' || matchesSearch(item, needle)),
  )
  const groups = groupByLine(visible)
  const lineCount = new Set(items.data.map((item) => item.line ?? NO_LINE)).size

  return (
    <>
      <div className="page-head">
        <h1>Catalog</h1>
        <p className="page-lede">
          {items.data.length} figures from {lineCount} lines.{' '}
          {isLoggedIn ? (
            'Add the ones you own to your collection.'
          ) : (
            <>
              <Link to="/login">Log in</Link> to add the ones you own to your collection.
            </>
          )}
        </p>
      </div>

      <div className="filters">
        <div className="field">
          <label htmlFor="catalog-search">Search</label>
          <input
            id="catalog-search"
            type="search"
            placeholder="Figure, line, or brand"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <BrandPicker brands={brands} total={items.data.length} selected={brand} onSelect={setBrand} />
      </div>

      {/* Announces the result count to screen readers as the filters change. */}
      <p className="result-count" aria-live="polite">
        {visible.length === items.data.length
          ? 'Showing every figure'
          : `Showing ${visible.length} of ${items.data.length} figures`}
      </p>

      {visible.length === 0 && (
        <div className="empty">
          <p>No figures match. Try a shorter search or a different brand.</p>
          <button
            type="button"
            className="button"
            onClick={() => {
              setSearch('')
              setBrand('')
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {groups.map(([line, lineItems]) => (
        <section key={line} className="line-group" aria-label={line}>
          <h2>
            {line} <span className="line-count">{lineItems.length}</span>
          </h2>
          <ul className="rows">
            {lineItems.map((item) => {
              const owned = ownedCounts.get(item.id) ?? 0
              return (
                // Slugs are unique and stable, so they are the right React key.
                <li key={item.slug} className="row">
                  <Thumbnail item={item} />
                  <div className="row-main">
                    <Link to={`/items/${item.slug}`} className="row-name">
                      {item.figure.trim()}
                    </Link>
                    {item.brand && <span className="row-meta">{item.brand}</span>}
                  </div>
                  <div className="row-actions">
                    {owned > 0 && (
                      <span className="sticker sticker-small">{owned === 1 ? 'Owned' : `Owned ×${owned}`}</span>
                    )}
                    {isLoggedIn && <QuickAdd item={item} />}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}
