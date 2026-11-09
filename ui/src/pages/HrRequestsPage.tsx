import { useState, type FormEvent } from 'react'
import { listEmployees, submitHrRequest, submitTimeOffRequest } from '../api/client'
import type { Employee, HrRequestAccepted } from '../api/types'
import { useLoader } from '../hooks/useLoader'
import { executionReference, validateDateRange, validatePrompt } from '../lib/validation'
import { ErrorMessage } from '../components/ErrorMessage'
import { LoadingIndicator } from '../components/LoadingIndicator'

/*
 * HR requests (FR4.1-FR4.4). The API only starts a workflow and returns 202 with an
 * execution ARN; there is no status endpoint, so the UI confirms submission and that HR
 * will receive the request by email, and never shows or implies a status (FR4.3).
 */

interface SubmissionState {
  isSubmitting: boolean
  accepted: HrRequestAccepted | null
  error: unknown
}

const IDLE: SubmissionState = { isSubmitting: false, accepted: null, error: undefined }

const EMPLOYEE_REQUIRED = 'Select an employee from the list'

function useSubmission() {
  const [state, setState] = useState<SubmissionState>(IDLE)
  const run = async (send: () => Promise<HrRequestAccepted>): Promise<boolean> => {
    setState({ isSubmitting: true, accepted: null, error: undefined })
    try {
      const accepted = await send()
      setState({ isSubmitting: false, accepted, error: undefined })
      return true
    } catch (error) {
      setState({ isSubmitting: false, accepted: null, error })
      return false
    }
  }
  return { ...state, run }
}

function Confirmation({ accepted, testId }: { accepted: HrRequestAccepted; testId: string }) {
  return (
    <div className="alert alert-success" role="status" data-testid={testId}>
      <p>Submitted. HR will receive this request by email.</p>
      <p className="muted">Reference: {executionReference(accepted.executionArn)}</p>
    </div>
  )
}

interface EmployeeSelectProps {
  id: string
  employees: Employee[]
  value: string
  error?: string
  onChange: (value: string) => void
  testId: string
}

/** FR4.4: the user_id is chosen from the employee list, never typed. */
function EmployeeSelect({ id, employees, value, error, onChange, testId }: EmployeeSelectProps) {
  return (
    <div className="field">
      <label htmlFor={id}>Employee</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        data-testid={testId}
      >
        <option value="">Choose an employee</option>
        {employees.map((employee) => (
          <option key={employee.employeeId} value={employee.employeeId}>
            {employee.name} ({employee.department})
          </option>
        ))}
      </select>
      {error && <span id={`${id}-error`} className="field-error">{error}</span>}
    </div>
  )
}

function TimeOffForm({ employees }: { employees: Employee[] }) {
  const [userId, setUserId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [errors, setErrors] = useState<{ employee?: string; start?: string; end?: string }>({})
  const submission = useSubmission()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found = { ...validateDateRange(startDate, endDate), employee: userId === '' ? EMPLOYEE_REQUIRED : undefined }
    setErrors(found)
    if (found.employee || found.start || found.end) {
      return
    }
    const sent = await submission.run(() => submitTimeOffRequest({ user_id: userId, start_date: startDate, end_date: endDate }))
    if (sent) {
      setStartDate('')
      setEndDate('')
    }
  }

  return (
    <form className="form panel" onSubmit={submit} noValidate aria-labelledby="time-off-heading" data-testid="time-off-form">
      <h2 id="time-off-heading">Time off</h2>
      <p className="muted">Request time off for an employee. HR receives the request by email.</p>
      <EmployeeSelect
        id="time-off-employee"
        employees={employees}
        value={userId}
        error={errors.employee}
        onChange={setUserId}
        testId="time-off-form-employee-select"
      />
      <div className="field">
        <label htmlFor="time-off-start">Start date</label>
        <input
          id="time-off-start"
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          aria-invalid={errors.start ? true : undefined}
          aria-describedby={errors.start ? 'time-off-start-error' : undefined}
          data-testid="time-off-form-start-input"
        />
        {errors.start && <span id="time-off-start-error" className="field-error">{errors.start}</span>}
      </div>
      <div className="field">
        <label htmlFor="time-off-end">End date</label>
        <input
          id="time-off-end"
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
          aria-invalid={errors.end ? true : undefined}
          aria-describedby={errors.end ? 'time-off-end-error' : undefined}
          data-testid="time-off-form-end-input"
        />
        {errors.end && <span id="time-off-end-error" className="field-error">{errors.end}</span>}
      </div>
      {submission.error !== undefined && <ErrorMessage error={submission.error} />}
      {submission.accepted && <Confirmation accepted={submission.accepted} testId="time-off-form-confirmation" />}
      <div>
        <button type="submit" className="btn btn-primary" disabled={submission.isSubmitting} data-testid="time-off-form-submit-button">
          {submission.isSubmitting ? 'Submitting' : 'Submit request'}
        </button>
      </div>
    </form>
  )
}

function QuestionForm({ employees }: { employees: Employee[] }) {
  const [userId, setUserId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [errors, setErrors] = useState<{ employee?: string; prompt?: string }>({})
  const submission = useSubmission()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found = {
      employee: userId === '' ? EMPLOYEE_REQUIRED : undefined,
      prompt: validatePrompt(prompt) ?? undefined,
    }
    setErrors(found)
    if (found.employee || found.prompt) {
      return
    }
    const sent = await submission.run(() => submitHrRequest({ user_id: userId, prompt: prompt.trim() }))
    if (sent) {
      setPrompt('')
    }
  }

  return (
    <form className="form panel" onSubmit={submit} noValidate aria-labelledby="question-heading" data-testid="question-form">
      <h2 id="question-heading">HR or benefits question</h2>
      <p className="muted">Send a question to HR on behalf of an employee. HR receives it by email.</p>
      <EmployeeSelect
        id="question-employee"
        employees={employees}
        value={userId}
        error={errors.employee}
        onChange={setUserId}
        testId="question-form-employee-select"
      />
      <div className="field">
        <label htmlFor="question-prompt">Question</label>
        <textarea
          id="question-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          aria-invalid={errors.prompt ? true : undefined}
          aria-describedby={errors.prompt ? 'question-prompt-error' : undefined}
          data-testid="question-form-prompt-input"
        />
        {errors.prompt && <span id="question-prompt-error" className="field-error">{errors.prompt}</span>}
      </div>
      {submission.error !== undefined && <ErrorMessage error={submission.error} />}
      {submission.accepted && <Confirmation accepted={submission.accepted} testId="question-form-confirmation" />}
      <div>
        <button type="submit" className="btn btn-primary" disabled={submission.isSubmitting} data-testid="question-form-submit-button">
          {submission.isSubmitting ? 'Submitting' : 'Send question'}
        </button>
      </div>
    </form>
  )
}

const loadEmployees = () => listEmployees()

/** /requests */
export function HrRequestsPage() {
  const { data: employees, error, isLoading, reload } = useLoader(loadEmployees)

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Requests</span>
          <h1>HR requests</h1>
        </div>
      </div>
      {isLoading && <LoadingIndicator label="Loading employees" />}
      {!isLoading && error !== undefined && <ErrorMessage error={error} onRetry={reload} />}
      {!isLoading && employees && (
        <div className="grid-2">
          <TimeOffForm employees={employees} />
          <QuestionForm employees={employees} />
        </div>
      )}
    </>
  )
}
