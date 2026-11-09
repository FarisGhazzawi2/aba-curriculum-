import { getConfig } from '../config'
import { getIdToken } from '../auth/session'
import { ApiError, NetworkError, raiseAuthError } from './errors'
import {
  KEY_ATTRIBUTES,
  type Employee,
  type EmployeeInput,
  type HireDateFilter,
  type HrRequest,
  type HrRequestAccepted,
  type Leave,
  type LeaveInput,
  type LeaveUpdate,
  type TimeOffRequest,
} from './types'

/*
 * Typed client for the HR REST API (FR1.3, FR1.5, FR2-FR4).
 * Every call sends the Cognito ID token as the Authorization header, maps 401/403 to
 * AuthError, FastAPI {detail} errors to ApiError, and transport failures to NetworkError.
 */

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'
type Query = Record<string, string | undefined>

interface RequestOptions {
  body?: unknown
  query?: Query
}

const NETWORK_ERROR_MESSAGE = 'Could not reach the HR API. Check your connection and try again.'

/** Joins the API base URL (which ends in /prod/) and a path that starts with /. */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(joinUrl(getConfig().apiUrl, path))
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}

function segment(value: string): string {
  return encodeURIComponent(value)
}

/** Removes the DynamoDB key attributes the API returns (FR2.7). */
export function stripKeyAttributes<T>(item: unknown): T {
  if (typeof item !== 'object' || item === null) {
    return item as T
  }
  const copy: Record<string, unknown> = { ...(item as Record<string, unknown>) }
  for (const key of KEY_ATTRIBUTES) {
    delete copy[key]
  }
  return copy as T
}

function messageFromDetail(detail: unknown): string | null {
  if (typeof detail === 'string' && detail.trim() !== '') {
    return detail
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) => (typeof entry === 'object' && entry !== null ? (entry as { msg?: unknown }).msg : null))
      .filter((msg): msg is string => typeof msg === 'string')
    return messages.length > 0 ? messages.join('; ') : null
  }
  return null
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    const detail = typeof body === 'object' && body !== null ? (body as { detail?: unknown }).detail : undefined
    const message = messageFromDetail(detail)
    if (message) {
      return message
    }
  } catch {
    // Not JSON (for example an API Gateway HTML or empty body); fall through to a generic message.
  }
  return response.status >= 500
    ? `The HR API had a problem (HTTP ${response.status}). Please try again.`
    : `The request failed (HTTP ${response.status}).`
}

async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getIdToken()
  const headers: Record<string, string> = { Authorization: token, Accept: 'application/json' }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch (error) {
    throw new NetworkError(NETWORK_ERROR_MESSAGE, { cause: error })
  }

  if (response.status === 401 || response.status === 403) {
    throw raiseAuthError(response.status)
  }
  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status)
  }
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError('The HR API returned a response that could not be read.', response.status)
  }
}

// ---------- Employees ----------

/** GET /employees; the hire-date filter is sent only when both dates are set. */
export async function listEmployees(filter?: Partial<HireDateFilter>): Promise<Employee[]> {
  const query: Query = {}
  if (filter?.hiredFrom && filter.hiredTo) {
    query.hiredFrom = filter.hiredFrom
    query.hiredTo = filter.hiredTo
  }
  const body = await request<{ employees: unknown[] }>('GET', '/employees', { query })
  return body.employees.map((item) => stripKeyAttributes<Employee>(item))
}

export async function getEmployee(employeeId: string): Promise<Employee> {
  return stripKeyAttributes<Employee>(await request('GET', `/employees/${segment(employeeId)}`))
}

export async function createEmployee(input: EmployeeInput): Promise<Employee> {
  return stripKeyAttributes<Employee>(await request('POST', '/employees', { body: input }))
}

export async function updateEmployee(employeeId: string, input: EmployeeInput): Promise<Employee> {
  return stripKeyAttributes<Employee>(
    await request('PUT', `/employees/${segment(employeeId)}`, { body: input }),
  )
}

export async function deleteEmployee(employeeId: string): Promise<{ deleted: string }> {
  return request('DELETE', `/employees/${segment(employeeId)}`)
}

// ---------- Leave ----------

/** GET /employees/{id}/leave with an optional YYYY-MM month filter. */
export async function listLeave(employeeId: string, month?: string): Promise<Leave[]> {
  const body = await request<{ leave: unknown[] }>('GET', `/employees/${segment(employeeId)}/leave`, {
    query: { month },
  })
  return body.leave.map((item) => stripKeyAttributes<Leave>(item))
}

export async function createLeave(employeeId: string, input: LeaveInput): Promise<Leave> {
  return stripKeyAttributes<Leave>(
    await request('POST', `/employees/${segment(employeeId)}/leave`, { body: input }),
  )
}

export async function updateLeave(employeeId: string, startDate: string, update: LeaveUpdate): Promise<Leave> {
  return stripKeyAttributes<Leave>(
    await request('PUT', `/employees/${segment(employeeId)}/leave/${segment(startDate)}`, { body: update }),
  )
}

// ---------- HR requests ----------

export async function submitTimeOffRequest(input: TimeOffRequest): Promise<HrRequestAccepted> {
  return request('POST', '/hr-requests/time-off', { body: input })
}

export async function submitHrRequest(input: HrRequest): Promise<HrRequestAccepted> {
  return request('POST', '/hr-requests', { body: input })
}
