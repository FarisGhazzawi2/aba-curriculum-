import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <>
      <div className="page-header">
        <h1>Page not found</h1>
      </div>
      <p>
        <Link to="/employees" data-testid="not-found-employees-link">
          Go to employees
        </Link>
      </p>
    </>
  )
}
