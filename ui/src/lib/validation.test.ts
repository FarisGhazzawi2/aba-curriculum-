import { describe, expect, it } from 'vitest'
import type { EmployeeInput } from '../api/types'
import {
  END_BEFORE_START_MESSAGE,
  executionReference,
  isIsoDate,
  validateDateRange,
  validateEmployee,
  validateHireFilter,
  validatePrompt,
} from './validation'

const validEmployee: EmployeeInput = {
  name: 'Ada Lovelace',
  department: 'Engineering',
  startDate: '2024-01-15',
  role: 'employee',
}

describe('validateEmployee (FR2.4, FR2.5)', () => {
  it('accepts a complete employee', () => {
    expect(validateEmployee(validEmployee)).toEqual({})
  })

  it('flags a missing name, including whitespace only', () => {
    expect(validateEmployee({ ...validEmployee, name: '   ' })).toEqual({ name: 'Name is required' })
  })

  it('flags a missing department and start date', () => {
    const errors = validateEmployee({ ...validEmployee, department: '', startDate: '' })
    expect(errors).toEqual({ department: 'Department is required', startDate: 'Start date is required' })
  })

  it('rejects an impossible start date', () => {
    expect(validateEmployee({ ...validEmployee, startDate: '2024-02-30' }).startDate).toBe(
      'Start date must be a valid date',
    )
  })
})

describe('validateDateRange (FR3.2, FR4.1)', () => {
  it('rejects an end date before the start date', () => {
    expect(validateDateRange('2026-11-05', '2026-11-01')).toEqual({ end: END_BEFORE_START_MESSAGE })
  })

  it('accepts a same-day range', () => {
    expect(validateDateRange('2026-11-05', '2026-11-05')).toEqual({})
  })

  it('accepts a range across months', () => {
    expect(validateDateRange('2026-11-28', '2026-12-02')).toEqual({})
  })

  it('requires both dates', () => {
    expect(validateDateRange('', '')).toEqual({ start: 'Start date is required', end: 'End date is required' })
  })
})

describe('validateHireFilter (FR2.2)', () => {
  it('rejects a filter with only one date', () => {
    expect(validateHireFilter({ hiredFrom: '2024-01-01' })).toBe('Both dates are required to filter by hire date.')
    expect(validateHireFilter({ hiredTo: '2024-12-31' })).toBe('Both dates are required to filter by hire date.')
  })

  it('rejects from after to', () => {
    expect(validateHireFilter({ hiredFrom: '2024-12-31', hiredTo: '2024-01-01' })).toBe(
      'The from date must be on or before the to date.',
    )
  })

  it('accepts both dates in order, including the same day', () => {
    expect(validateHireFilter({ hiredFrom: '2024-01-01', hiredTo: '2024-12-31' })).toBeNull()
    expect(validateHireFilter({ hiredFrom: '2024-01-01', hiredTo: '2024-01-01' })).toBeNull()
  })

  it('cannot be applied with no dates', () => {
    expect(validateHireFilter({})).not.toBeNull()
  })
})

describe('validatePrompt (FR4.2)', () => {
  it('rejects empty and whitespace-only text', () => {
    expect(validatePrompt('')).toBe('Please enter a message.')
    expect(validatePrompt(' \n ')).toBe('Please enter a message.')
  })

  it('accepts real text', () => {
    expect(validatePrompt('How many leave days do I have?')).toBeNull()
  })
})

describe('executionReference (FR4.3)', () => {
  it('derives the reference from the ARN tail', () => {
    expect(executionReference('arn:aws:states:us-east-1:111111111111:execution:HrStateMachine:abc-123')).toBe(
      'abc-123',
    )
  })

  it('shortens a long execution name to 12 characters', () => {
    expect(
      executionReference(
        'arn:aws:states:us-east-1:111111111111:execution:HrStateMachine:0f8e2c1a-77b4-4e61-9d0a-1c2b3d4e5f60',
      ),
    ).toBe('0f8e2c1a-77b')
  })

  it('handles an empty ARN', () => {
    expect(executionReference('')).toBe('unavailable')
  })
})

describe('isIsoDate', () => {
  it('accepts real dates and rejects malformed ones', () => {
    expect(isIsoDate('2024-02-29')).toBe(true)
    expect(isIsoDate('2023-02-29')).toBe(false)
    expect(isIsoDate('15/01/2024')).toBe(false)
  })
})
