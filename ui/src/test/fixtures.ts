import type { Employee, Leave } from '../api/types'

/* Shared, typed test data (shapes from src/api/types.ts, which mirror the API). */

export function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    employeeId: 'a1b2c3d4',
    name: 'Ada Lovelace',
    department: 'Engineering',
    startDate: '2024-01-15',
    role: 'employee',
    ...overrides,
  }
}

export function makeLeave(overrides: Partial<Leave> = {}): Leave {
  return {
    employeeId: 'a1b2c3d4',
    startDate: '2026-11-02',
    endDate: '2026-11-06',
    note: 'Family visit',
    ...overrides,
  }
}

export const EXECUTION_ARN = 'arn:aws:states:us-east-1:111111111111:execution:HrStateMachine:abc-123'
