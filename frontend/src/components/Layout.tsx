import { useQuery } from '@tanstack/react-query'
import { Link, NavLink, Outlet } from 'react-router'
import { setToken, useAuthToken } from '../authStore.ts'
import { meQuery } from '../queries.ts'

/** Site header plus the main area where the current page renders. */
export default function Layout() {
  const token = useAuthToken()
  const isLoggedIn = token !== null
  const me = useQuery({ ...meQuery, enabled: isLoggedIn })

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="wordmark">
            Pile of Plastic
          </Link>
          <nav className="site-nav" aria-label="Main">
            <NavLink to="/" end>
              Catalog
            </NavLink>
            <NavLink to="/collection">My collection</NavLink>
          </nav>
          <div className="site-account">
            {isLoggedIn ? (
              <>
                {me.data && <span className="account-email">{me.data.email}</span>}
                {/* Clearing the token logs out; main.tsx then clears cached user data. */}
                <button type="button" className="button button-on-blue" onClick={() => setToken(null)}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login">Log in</NavLink>
                <Link to="/register" className="button button-on-blue">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
