import { Link, NavLink, Outlet } from 'react-router-dom'
import { SessionExpiredBanner } from './SessionExpiredBanner'

interface AppLayoutProps {
  onSignOut: () => void
}

const NAV_ITEMS = [
  { to: '/employees', label: 'Employees', testId: 'app-nav-employees-link' },
  { to: '/requests', label: 'HR Requests', testId: 'app-nav-requests-link' },
  { to: '/assistant', label: 'Assistant', testId: 'app-nav-assistant-link' },
] as const

/** Full-width green header with the text wordmark and uppercase navigation (FR8.1, FR8.4). */
export function AppLayout({ onSignOut }: AppLayoutProps) {
  return (
    <>
      <a href="#main-content" className="visually-hidden">
        Skip to content
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/employees" className="wordmark" data-testid="app-header-wordmark-link">
            HR Leave Portal
          </Link>
          <nav className="app-nav" aria-label="Main">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} data-testid={item.testId}>
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              className="btn btn-on-primary"
              onClick={onSignOut}
              data-testid="app-header-sign-out-button"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <SessionExpiredBanner onSignInAgain={onSignOut} />
      <main id="main-content" className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        HR staff tool. Every signed-in user can view and change all records.
      </footer>
    </>
  )
}
