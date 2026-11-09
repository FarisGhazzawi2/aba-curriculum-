/*
 * Shapes of the HR REST API (api/models.py, api/services/*.py).
 * Naming is kept exactly as the API uses it (C4): camelCase for employees and leave,
 * snake_case for HR requests. The DynamoDB key attributes (PK, SK, GSI1PK, GSI1SK)
 * are stripped by the client and never reach these types (FR2.7).
 */

export interface Employee {
  employeeId: string
  name: string
  department: string
  /** ISO date, YYYY-MM-DD */
  startDate: string
  role: string
}

export interface EmployeeInput {
  name: string
  department: string
  startDate: string
  role: string
}

export interface Leave {
  employeeId: string
  /** ISO date, YYYY-MM-DD; also the leave entry's key */
  startDate: string
  endDate: string
  note: string
}

export interface LeaveInput {
  startDate: string
  endDate: string
  note: string
}

export interface LeaveUpdate {
  endDate: string
  note: string
}

export interface TimeOffRequest {
  user_id: string
  start_date: string
  end_date: string
}

export interface HrRequest {
  user_id: string
  prompt: string
}

/** 202 response of both HR-request endpoints. There is no status endpoint (FR4.3). */
export interface HrRequestAccepted {
  executionArn: string
}

export interface HireDateFilter {
  hiredFrom: string
  hiredTo: string
}

export const KEY_ATTRIBUTES = ['PK', 'SK', 'GSI1PK', 'GSI1SK'] as const
