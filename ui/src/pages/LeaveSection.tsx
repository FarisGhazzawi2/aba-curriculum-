import { useCallback, useState, type FormEvent } from 'react'
import { createLeave, listLeave, updateLeave } from '../api/client'
import type { Leave, LeaveInput } from '../api/types'
import { useLoader } from '../hooks/useLoader'
import { validateDateRange, type FieldErrors } from '../lib/validation'
import { EmptyState } from '../components/EmptyState'
import { ErrorMessage } from '../components/ErrorMessage'
import { LoadingIndicator } from '../components/LoadingIndicator'

const EMPTY_LEAVE: LeaveInput = { startDate: '', endDate: '', note: '' }

interface AddLeaveFormProps {
  employeeId: string
  onAdded: () => void
}

/** FR3.2: end before start is blocked here because the API does not check it. */
function AddLeaveForm({ employeeId, onAdded }: AddLeaveFormProps) {
  const [values, setValues] = useState<LeaveInput>(EMPTY_LEAVE)
  const [errors, setErrors] = useState<FieldErrors<'start' | 'end'>>({})
  const [saveError, setSaveError] = useState<unknown>(undefined)
  const [isSaving, setIsSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validateDateRange(values.startDate, values.endDate)
    setErrors(found)
    if (found.start || found.end) {
      return
    }
    setIsSaving(true)
    setSaveError(undefined)
    try {
      await createLeave(employeeId, { ...values, note: values.note.trim() })
      setValues(EMPTY_LEAVE)
      onAdded()
    } catch (error) {
      setSaveError(error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="form panel" onSubmit={submit} noValidate aria-labelledby="add-leave-heading" data-testid="leave-add-form">
      <h3 id="add-leave-heading">Add leave</h3>
      {saveError !== undefined && <ErrorMessage error={saveError} />}
      <div className="field">
        <label htmlFor="leave-start">Start date</label>
        <input
          id="leave-start"
          type="date"
          value={values.startDate}
          aria-invalid={errors.start ? true : undefined}
          aria-describedby={errors.start ? 'leave-start-error' : undefined}
          onChange={(event) => setValues({ ...values, startDate: event.target.value })}
          data-testid="leave-add-start-input"
        />
        {errors.start && <span id="leave-start-error" className="field-error">{errors.start}</span>}
      </div>
      <div className="field">
        <label htmlFor="leave-end">End date</label>
        <input
          id="leave-end"
          type="date"
          value={values.endDate}
          aria-invalid={errors.end ? true : undefined}
          aria-describedby={errors.end ? 'leave-end-error' : undefined}
          onChange={(event) => setValues({ ...values, endDate: event.target.value })}
          data-testid="leave-add-end-input"
        />
        {errors.end && <span id="leave-end-error" className="field-error">{errors.end}</span>}
      </div>
      <div className="field">
        <label htmlFor="leave-note">Note</label>
        <input
          id="leave-note"
          type="text"
          value={values.note}
          onChange={(event) => setValues({ ...values, note: event.target.value })}
          data-testid="leave-add-note-input"
        />
      </div>
      <div>
        <button type="submit" className="btn btn-primary" disabled={isSaving} data-testid="leave-add-submit-button">
          {isSaving ? 'Saving' : 'Add leave'}
        </button>
      </div>
    </form>
  )
}

interface LeaveRowProps {
  employeeId: string
  leave: Leave
  onSaved: () => void
}

/** FR3.3: end date and note are editable; the start date is the key and stays read-only. */
function LeaveRow({ employeeId, leave, onSaved }: LeaveRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [endDate, setEndDate] = useState(leave.endDate)
  const [note, setNote] = useState(leave.note)
  const [problem, setProblem] = useState<unknown>(undefined)
  const [isSaving, setIsSaving] = useState(false)

  const save = async () => {
    const found = validateDateRange(leave.startDate, endDate)
    if (found.end) {
      setProblem(new Error(found.end))
      return
    }
    setIsSaving(true)
    setProblem(undefined)
    try {
      await updateLeave(employeeId, leave.startDate, { endDate, note: note.trim() })
      setIsEditing(false)
      onSaved()
    } catch (error) {
      setProblem(error)
    } finally {
      setIsSaving(false)
    }
  }

  const cancel = () => {
    setEndDate(leave.endDate)
    setNote(leave.note)
    setProblem(undefined)
    setIsEditing(false)
  }

  if (!isEditing) {
    return (
      <tr data-testid="leave-table-row">
        <td>{leave.startDate}</td>
        <td>{leave.endDate}</td>
        <td>{leave.note}</td>
        <td>
          <button type="button" className="btn btn-link" onClick={() => setIsEditing(true)} data-testid="leave-table-row-edit-button">
            Edit<span className="visually-hidden"> leave starting {leave.startDate}</span>
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr data-testid="leave-table-row-editing">
      <td>
        <label className="visually-hidden" htmlFor={`leave-edit-start-${leave.startDate}`}>Start date (read-only)</label>
        <input id={`leave-edit-start-${leave.startDate}`} type="date" value={leave.startDate} readOnly />
      </td>
      <td>
        <label className="visually-hidden" htmlFor={`leave-edit-end-${leave.startDate}`}>End date</label>
        <input
          id={`leave-edit-end-${leave.startDate}`}
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
          data-testid="leave-edit-end-input"
        />
      </td>
      <td>
        <label className="visually-hidden" htmlFor={`leave-edit-note-${leave.startDate}`}>Note</label>
        <input
          id={`leave-edit-note-${leave.startDate}`}
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          data-testid="leave-edit-note-input"
        />
        {problem !== undefined && <ErrorMessage error={problem} />}
      </td>
      <td>
        <div className="button-row">
          <button type="button" className="btn btn-primary" onClick={save} disabled={isSaving} data-testid="leave-edit-save-button">
            Save
          </button>
          <button type="button" className="btn btn-secondary" onClick={cancel} disabled={isSaving} data-testid="leave-edit-cancel-button">
            Cancel
          </button>
        </div>
      </td>
    </tr>
  )
}

interface LeaveSectionProps {
  employeeId: string
}

/** Leave list with a month filter, add form and inline edit. There is no delete (FR3.1-FR3.4). */
export function LeaveSection({ employeeId }: LeaveSectionProps) {
  const [monthInput, setMonthInput] = useState('')
  const [month, setMonth] = useState<string | undefined>(undefined)
  const load = useCallback(() => listLeave(employeeId, month), [employeeId, month])
  const { data: leave, error, isLoading, reload } = useLoader(load)

  const applyMonth = (event: FormEvent) => {
    event.preventDefault()
    setMonth(monthInput === '' ? undefined : monthInput)
  }

  return (
    <section className="section" aria-labelledby="leave-heading">
      <h2 id="leave-heading">Leave</h2>
      <div className="grid-2">
        <div>
          <form className="form-inline" onSubmit={applyMonth} aria-label="Filter leave by month" data-testid="leave-month-form">
            <div className="field">
              <label htmlFor="leave-month">Month</label>
              <input
                id="leave-month"
                type="month"
                value={monthInput}
                pattern="\d{4}-\d{2}"
                placeholder="YYYY-MM"
                onChange={(event) => setMonthInput(event.target.value)}
                data-testid="leave-month-input"
              />
            </div>
            <button type="submit" className="btn btn-secondary" data-testid="leave-month-apply-button">
              {monthInput === '' ? 'Show all' : 'Apply'}
            </button>
          </form>
          <div className="section">
            {isLoading && <LoadingIndicator label="Loading leave" />}
            {!isLoading && error !== undefined && <ErrorMessage error={error} onRetry={reload} />}
            {!isLoading && leave && leave.length === 0 && (
              <EmptyState title={month ? `No leave starting in ${month}.` : 'No leave recorded.'} />
            )}
            {!isLoading && leave && leave.length > 0 && (
              <div className="table-wrap">
                <table data-testid="leave-table">
                  <caption className="visually-hidden">Leave entries</caption>
                  <thead>
                    <tr>
                      <th scope="col">Start date</th>
                      <th scope="col">End date</th>
                      <th scope="col">Note</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leave.map((entry) => (
                      <LeaveRow key={entry.startDate} employeeId={employeeId} leave={entry} onSaved={reload} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <AddLeaveForm employeeId={employeeId} onAdded={reload} />
      </div>
    </section>
  )
}
