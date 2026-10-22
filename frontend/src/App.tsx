import { useQuery } from '@tanstack/react-query'
import { itemsQuery } from './queries.ts'

/** Catalog table: loading, error, empty, and success states. */
function ItemList() {
  const { data: items, isPending, isError, error } = useQuery(itemsQuery)

  if (isPending) return <p>Loading…</p>
  if (isError) return <p role="alert">Could not load items: {error.message}</p>
  if (items.length === 0) return <p>No items in the catalog yet.</p>

  return (
    <table>
      <thead>
        <tr>
          <th>Figure</th>
          <th>Line</th>
          <th>Brand</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.slug}>
            <td>{item.figure}</td>
            <td>{item.line}</td>
            <td>{item.brand}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function App() {
  return (
    <main>
      <h1>Catalog</h1>
      <ItemList />
    </main>
  )
}