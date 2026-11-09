import type { EmployeeInput, HireDateFilter } from '../api/types'

/*
 * Pure validation and business rules the API does not enforce itself
 * (FR2.2, FR2.4, FR3.2, FR4.1, FR4.2, FR4.3). Every message is plain text so
 * errors are never conveyed by colour alone (NFR6).
 */

export type FieldErrors<K extends string> = Partial<Record<K, string>>

export const END_BEFORE_START_MESSAGE = 'End date must be on or after start date'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** True for a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) {
    return false
  }
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

/** FR2.4 / FR2.5: name, department and start date are required. */
export function validateEmployee(input: EmployeeInput): FieldErrors<keyof EmployeeInput> {
  const errors: FieldErrors<keyof EmployeeInput> = {}
  if (input.name.trim() === '') {
    errors.name = 'Name is required'
  }
  if (input.department.trim() === '') {
    errors.department = 'Department is required'
  }
  if (input.startDate === '') {
    errors.startDate = 'Start date is required'
  } else if (!isIsoDate(input.startDate)) {
    errors.startDate = 'Start date must be a valid date'
  }
  if (input.role.trim() === '') {
    errors.role = 'Role is required'
  }
  return errors
}

/** FR3.2 / FR4.1: both dates required, end on or after start (same day allowed). */
export function validateDateRange(start: string, end: string): FieldErrors<'start' | 'end'> {
  const errors: FieldErrors<'start' | 'end'> = {}
  if (start === '' || !isIsoDate(start)) {
    errors.start = start === '' ? 'Start date is required' : 'Start date must be a valid date'
  }
  if (end === '' || !isIsoDate(end)) {
    errors.end = end === '' ? 'End date is required' : 'End date must be a valid date'
  }
  if (!errors.start && !errors.end && end < start) {
    errors.end = END_BEFORE_START_MESSAGE
  }
  return errors
}

/**
 * FR2.2: the hire-date filter needs both dates, with from on or before to.
 * Returns null when the filter can be applied, otherwise the reason it cannot.
 */
export function validateHireFilter(filter: Partial<HireDateFilter>): string | null {
  const from = filter.hiredFrom ?? ''
  const to = filter.hiredTo ?? ''
  if (from === '' && to === '') {
    return 'Choose both a from date and a to date to filter.'
  }
  if (from === '' || to === '') {
    return 'Both dates are required to filter by hire date.'
  }
  if (!isIsoDate(from) || !isIsoDate(to)) {
    return 'Enter valid dates to filter by hire date.'
  }
  if (from > to) {
    return 'The from date must be on or before the to date.'
  }
  return null
}

/** FR4.2: an HR question needs non-empty text. Also used for agent chat input. */
export function validatePrompt(prompt: string): string | null {
  return prompt.trim() === '' ? 'Please enter a message.' : null
}

/**
 * FR4.3: a short reference for the user, taken from the tail of the execution ARN
 * (arn:aws:states:<region>:<account>:execution:<stateMachine>:<name>). It is a
 * reference only; the UI never shows a status.
 */
export function executionReference(executionArn: string): string {
  const name = executionArn.split(':').at(-1) ?? ''
  if (name === '') {
    return 'unavailable'
  }
  return name.length > 12 ? name.slice(0, 12) : name
}
