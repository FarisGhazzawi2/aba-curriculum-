import { useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createEmployee, getEmployee, updateEmployee } from '../api/client'
import type { Employee, EmployeeInput } from '../api/types'
import { useLoader } from '../hooks/useLoader'
import { validateEmployee, type FieldErrors } from '../lib/validation'
import { ErrorMessage } from '../components/ErrorMessage'
import { LoadingIndicator } from '../components/LoadingIndicator'

type Field = keyof EmployeeInput

const EMPTY_EMPLOYEE: EmployeeInput = { name: '', department: '', startDate: '', role: 'employee' }

const FIELDS: { name: Field; label: string; type: string }[] = [
  { name: 'name', label: 'Name', type: 'text' },
  { name: 'department', label: 'Department', type: 'text' },
  { name: 'startDate', label: 'Start date', type: 'date' },
  { name: 'role', label: 'Role', type: 'text' },
]

interface EmployeeFieldsProps {
  initial: EmployeeInput
  submitLabel: string
  cancelTo: string
  onSave: (input: EmployeeInput) => Promise<Employee>
}

/** The shared create/edit form with the FR2.4 validation. */
function EmployeeFields({ initial, submitLabel, cancelTo, onSave }: EmployeeFieldsProps) {
  const navigate = useNavigate()
  const [values, setValues] = useState<EmployeeInput>(initial)
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [saveError, setSaveError] = useState<unknown>(undefined)
  const [isSaving, setIsSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found = validateEmployee(values)
    setErrors(found)
    const firstInvalid = FIELDS.find((field) => found[field.name])
    if (firstInvalid) {
      event.currentTarget.querySelector<HTMLInputElement>(`#employee-${firstInvalid.name}`)?.focus()
      return
    }
    setIsSaving(true)
    setSaveError(undefined)
    try {
      const saved = await onSave({ ...values, name: values.name.trim(), department: values.department.trim(), role: values.role.trim() })
      navigate(`/employees/${encodeURIComponent(saved.employeeId)}`)
    } catch (error) {
      setSaveError(error)
      setIsSaving(false)
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate data-testid="employee-form">
      {saveError !== undefined && <ErrorMessage error={saveError} />}
      {FIELDS.map((field) => {
        const error = errors[field.name]
        const errorId = `employee-${field.name}-error`
        return (
          <div className="field" key={field.name}>
            <label htmlFor={`employee-${field.name}`}>{field.label}</label>
            <input
              id={`employee-${field.name}`}
              type={field.type}
              value={values[field.name]}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
              data-testid={`employee-form-${field.name}-input`}
            />
            {error && (
              <span id={errorId} className="field-error">
                {error}
              </span>
            )}
          </div>
        )
      })}
      <div className="button-row">
        <button type="submit" className="btn btn-primary" disabled={isSaving} data-testid="employee-form-submit-button">
          {isSaving ? 'Saving' : submitLabel}
        </button>
        <Link to={cancelTo} className="btn btn-secondary" data-testid="employee-form-cancel-link">
          Cancel
        </Link>
      </div>
    </form>
  )
}

function NewEmployee() {
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Employees</span>
          <h1>New employee</h1>
        </div>
      </div>
      <EmployeeFields initial={EMPTY_EMPLOYEE} submitLabel="Create employee" cancelTo="/employees" onSave={createEmployee} />
    </>
  )
}

function EditEmployee({ employeeId }: { employeeId: string }) {
  const load = useCallback(() => getEmployee(employeeId), [employeeId])
  const { data: employee, error, isLoading, reload } = useLoader(load)
  const save = useCallback((input: EmployeeInput) => updateEmployee(employeeId, input), [employeeId])
  const detailPath = `/employees/${encodeURIComponent(employeeId)}`

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Employees</span>
          <h1>Edit employee</h1>
        </div>
      </div>
      {isLoading && <LoadingIndicator label="Loading employee" />}
      {!isLoading && error !== undefined && <ErrorMessage error={error} onRetry={reload} />}
      {!isLoading && employee && (
        <EmployeeFields
          initial={{ name: employee.name, department: employee.department, startDate: employee.startDate, role: employee.role }}
          submitLabel="Save changes"
          cancelTo={detailPath}
          onSave={save}
        />
      )}
    </>
  )
}

/** /employees/new and /employees/:id/edit (FR2.4, FR2.5). */
export function EmployeeForm() {
  const { id } = useParams()
  return id ? <EditEmployee employeeId={id} /> : <NewEmployee />
}
