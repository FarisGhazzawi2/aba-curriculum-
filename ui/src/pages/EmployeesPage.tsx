import { useCallback, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { listEmployees } from '../api/client'
import type { HireDateFilter } from '../api/types'
import { useLoader } from '../hooks/useLoader'
import { validateHireFilter } from '../lib/validation'
import { EmptyState } from '../components/EmptyState'
import { ErrorMessage } from '../components/ErrorMessage'
import { LoadingIndicator } from '../components/LoadingIndicator'

/** Employee list with an optional hire-date filter (FR2.1, FR2.2, C3: no pagination). */
export function EmployeesPage() {
  const [hiredFrom, setHiredFrom] = useState('')
  const [hiredTo, setHiredTo] = useState('')
  const [appliedFilter, setAppliedFilter] = useState<HireDateFilter | null>(null)

  const load = useCallback(() => listEmployees(appliedFilter ?? undefined), [appliedFilter])
  const { data: employees, error, isLoading, reload } = useLoader(load)

  const filterProblem = validateHireFilter({ hiredFrom, hiredTo })

  const applyFilter = (event: FormEvent) => {
    event.preventDefault()
    if (filterProblem === null) {
      setAppliedFilter({ hiredFrom, hiredTo })
    }
  }

  const clearFilter = () => {
    setHiredFrom('')
    setHiredTo('')
    setAppliedFilter(null)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Directory</span>
          <h1>Employees</h1>
        </div>
        <Link to="/employees/new" className="btn btn-primary" data-testid="employees-page-new-employee-link">
          New employee
        </Link>
      </div>

      <form className="form-inline" onSubmit={applyFilter} aria-label="Filter by hire date" data-testid="employees-filter-form">
        <div className="field">
          <label htmlFor="hired-from">Hired from</label>
          <input
            id="hired-from"
            type="date"
            value={hiredFrom}
            onChange={(event) => setHiredFrom(event.target.value)}
            aria-describedby="hire-filter-hint"
            data-testid="employees-filter-from-input"
          />
        </div>
        <div className="field">
          <label htmlFor="hired-to">Hired to</label>
          <input
            id="hired-to"
            type="date"
            value={hiredTo}
            onChange={(event) => setHiredTo(event.target.value)}
            aria-describedby="hire-filter-hint"
            data-testid="employees-filter-to-input"
          />
        </div>
        <button
          type="submit"
          className="btn btn-secondary"
          disabled={filterProblem !== null}
          data-testid="employees-filter-apply-button"
        >
          Apply
        </button>
        {appliedFilter && (
          <button type="button" className="btn btn-link" onClick={clearFilter} data-testid="employees-filter-clear-button">
            Clear filter
          </button>
        )}
      </form>
      <p id="hire-filter-hint" className="field-hint" data-testid="employees-filter-hint">
        {filterProblem ?? 'Ready to filter by hire date.'}
      </p>

      <div className="section">
        {isLoading && <LoadingIndicator label="Loading employees" />}
        {!isLoading && error !== undefined && <ErrorMessage error={error} onRetry={reload} />}
        {!isLoading && employees && employees.length === 0 && (
          <EmptyState title={appliedFilter ? 'No employees were hired in this date range.' : 'No employees yet.'} />
        )}
        {!isLoading && employees && employees.length > 0 && (
          <div className="table-wrap">
            <table data-testid="employees-table">
              <caption className="visually-hidden">Employees</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Department</th>
                  <th scope="col">Start date</th>
                  <th scope="col">Role</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.employeeId} data-testid="employees-table-row">
                    <td>
                      <Link to={`/employees/${encodeURIComponent(employee.employeeId)}`} data-testid="employees-table-row-link">
                        {employee.name}
                      </Link>
                    </td>
                    <td>{employee.department}</td>
                    <td>{employee.startDate}</td>
                    <td>{employee.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
