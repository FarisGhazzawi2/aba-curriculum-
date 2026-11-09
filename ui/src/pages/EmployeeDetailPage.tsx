import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteEmployee, getEmployee } from '../api/client'
import type { Employee } from '../api/types'
import { useLoader } from '../hooks/useLoader'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ErrorMessage } from '../components/ErrorMessage'
import { LoadingIndicator } from '../components/LoadingIndicator'
import { LeaveSection } from './LeaveSection'

interface EmployeeDetailsProps {
  employee: Employee
}

/** Details, edit and delete-with-confirmation (FR2.3, FR2.6). */
function EmployeeDetails({ employee }: EmployeeDetailsProps) {
  const navigate = useNavigate()
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<unknown>(undefined)
  const basePath = `/employees/${encodeURIComponent(employee.employeeId)}`

  const confirmDelete = async () => {
    setIsDeleting(true)
    setDeleteError(undefined)
    try {
      await deleteEmployee(employee.employeeId)
      navigate('/employees')
    } catch (error) {
      setDeleteError(error)
      setIsDeleting(false)
      setIsConfirming(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Employee</span>
          <h1>{employee.name}</h1>
        </div>
        <div className="button-row">
          <Link to={`${basePath}/edit`} className="btn btn-secondary" data-testid="employee-detail-edit-link">
            Edit
          </Link>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setIsConfirming(true)}
            data-testid="employee-detail-delete-button"
          >
            Delete
          </button>
        </div>
      </div>

      {deleteError !== undefined && <ErrorMessage error={deleteError} />}

      <dl className="details" data-testid="employee-detail-list">
        <dt>Employee id</dt>
        <dd>{employee.employeeId}</dd>
        <dt>Department</dt>
        <dd>{employee.department}</dd>
        <dt>Start date</dt>
        <dd>{employee.startDate}</dd>
        <dt>Role</dt>
        <dd>{employee.role}</dd>
      </dl>

      <LeaveSection employeeId={employee.employeeId} />

      {isConfirming && (
        <ConfirmDialog
          title="Delete employee"
          confirmLabel={isDeleting ? 'Deleting' : `Delete ${employee.name}`}
          onConfirm={confirmDelete}
          onCancel={() => setIsConfirming(false)}
          isBusy={isDeleting}
        >
          <p>
            Delete <strong>{employee.name}</strong> ({employee.department}, id {employee.employeeId})? This cannot be
            undone. Their leave entries are not removed.
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}

/** /employees/:id */
export function EmployeeDetailPage() {
  const { id = '' } = useParams()
  const load = useCallback(() => getEmployee(id), [id])
  const { data: employee, error, isLoading, reload } = useLoader(load)

  return (
    <>
      <p>
        <Link to="/employees" data-testid="employee-detail-back-link">
          Back to employees
        </Link>
      </p>
      {isLoading && <LoadingIndicator label="Loading employee" />}
      {!isLoading && error !== undefined && <ErrorMessage error={error} onRetry={reload} />}
      {!isLoading && employee && <EmployeeDetails employee={employee} />}
    </>
  )
}
