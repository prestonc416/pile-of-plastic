import { Link } from 'react-router'

/** Shown for any URL that matches no route. */
export default function NotFoundPage() {
  return (
    <div className="empty">
      <h1>Page not found</h1>
      <p>There is nothing at this address.</p>
      <Link to="/" className="button button-primary">
        Go to the catalog
      </Link>
    </div>
  )
}
