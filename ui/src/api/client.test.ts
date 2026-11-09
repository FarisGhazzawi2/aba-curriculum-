import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAuthSession } from 'aws-amplify/auth'
import { ConfigError, loadConfig, setConfig, type AppConfig } from '../config'
import { onAuthError } from '../auth/authEvents'
import { AuthError, ApiError, NetworkError } from './errors'
import {
  createLeave,
  deleteEmployee,
  getEmployee,
  joinUrl,
  listEmployees,
  listLeave,
  submitTimeOffRequest,
  updateLeave,
} from './client'

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
}))

const testConfig: AppConfig = {
  apiUrl: 'https://abc123.execute-api.us-east-1.amazonaws.com/prod/',
  region: 'us-east-1',
  userPoolId: 'us-east-1_TEST',
  userPoolClientId: 'test-client-id',
  agentRuntimeArn: 'arn:aws:bedrock-agentcore:us-east-1:111111111111:runtime/hrAgent-TEST',
}

// The raw DynamoDB item exactly as api/services/employee_service.py returns it.
const rawEmployee = {
  PK: 'USER',
  SK: 'a1b2c3d4',
  GSI1PK: 'USER_BY_DATE',
  GSI1SK: '2024-01-15',
  employeeId: 'a1b2c3d4',
  name: 'Ada Lovelace',
  department: 'Engineering',
  startDate: '2024-01-15',
  role: 'employee',
}

const rawLeave = {
  PK: 'a1b2c3d4',
  SK: '2026-11-02',
  employeeId: 'a1b2c3d4',
  startDate: '2026-11-02',
  endDate: '2026-11-06',
  note: 'Family visit',
}

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function lastRequest(): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls.at(-1) ?? []
  return { url: String(url), init: init ?? {} }
}

function headerOf(init: RequestInit, name: string): string | undefined {
  return (init.headers as Record<string, string>)[name]
}

beforeEach(() => {
  setConfig(testConfig)
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(fetchAuthSession).mockResolvedValue({
    tokens: {
      idToken: { toString: () => 'id-token-test', payload: { sub: 'user-sub-test' } },
      accessToken: { toString: () => 'access-token-test', payload: { sub: 'user-sub-test' } },
    },
  } as unknown as Awaited<ReturnType<typeof fetchAuthSession>>)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('API client authentication (FR1.3, FR1.5)', () => {
  it('sends the ID token, not the access token, as the Authorization header', async () => {
    fetchMock.mockResolvedValue(jsonResponse(rawEmployee))

    await getEmployee('a1b2c3d4')

    const { url, init } = lastRequest()
    expect(url).toBe('https://abc123.execute-api.us-east-1.amazonaws.com/prod/employees/a1b2c3d4')
    expect(init.method).toBe('GET')
    expect(headerOf(init, 'Authorization')).toBe('id-token-test')
  })

  it('throws AuthError on 401 and notifies the session banner', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Unauthorized' }, 401))
    const listener = vi.fn()
    const unsubscribe = onAuthError(listener)

    await expect(listEmployees()).rejects.toBeInstanceOf(AuthError)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('throws AuthError on 403', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Forbidden' }, 403))

    await expect(listEmployees()).rejects.toMatchObject({ name: 'AuthError', status: 403 })
  })

  it('throws AuthError without calling the API when there is no session', async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue({} as Awaited<ReturnType<typeof fetchAuthSession>>)

    await expect(listEmployees()).rejects.toBeInstanceOf(AuthError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('API client errors', () => {
  it('maps a 404 detail to ApiError("Employee not found")', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Employee not found' }, 404))

    const error = await getEmployee('missing').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ message: 'Employee not found', status: 404 })
  })

  it('joins FastAPI 422 validation messages', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: [{ loc: ['body', 'startDate'], msg: 'Input should be a valid date' }] }, 422),
    )

    await expect(createLeave('a1b2c3d4', { startDate: 'x', endDate: 'y', note: '' })).rejects.toThrow(
      'Input should be a valid date',
    )
  })

  it('gives a generic message for a 5XX without a JSON body', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }))

    await expect(listEmployees()).rejects.toThrow('The HR API had a problem (HTTP 502). Please try again.')
  })

  it('maps a transport failure to NetworkError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(listEmployees()).rejects.toBeInstanceOf(NetworkError)
  })
})

describe('API client data handling (FR2.2, FR2.7, FR3.1, FR4.1)', () => {
  it('strips PK, SK, GSI1PK and GSI1SK from employees', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ employees: [rawEmployee] }))

    const employees = await listEmployees()

    expect(employees).toEqual([
      { employeeId: 'a1b2c3d4', name: 'Ada Lovelace', department: 'Engineering', startDate: '2024-01-15', role: 'employee' },
    ])
  })

  it('strips key attributes from leave items', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ leave: [rawLeave] }))

    const leave = await listLeave('a1b2c3d4', '2026-11')

    expect(leave[0]).not.toHaveProperty('PK')
    expect(leave[0]).not.toHaveProperty('SK')
    expect(leave[0]).toMatchObject({ startDate: '2026-11-02', endDate: '2026-11-06' })
    expect(lastRequest().url).toContain('/employees/a1b2c3d4/leave?month=2026-11')
  })

  it('sends the hire-date query only when both dates are set', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ employees: [] }))

    await listEmployees({ hiredFrom: '2024-01-01' })
    expect(lastRequest().url).toBe('https://abc123.execute-api.us-east-1.amazonaws.com/prod/employees')

    await listEmployees({ hiredFrom: '2024-01-01', hiredTo: '2024-12-31' })
    expect(lastRequest().url).toBe(
      'https://abc123.execute-api.us-east-1.amazonaws.com/prod/employees?hiredFrom=2024-01-01&hiredTo=2024-12-31',
    )
  })

  it('sends JSON bodies with the API field names as they are', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ executionArn: 'arn:aws:states:us-east-1:111111111111:execution:HrStateMachine:abc-123' }, 202))

    const accepted = await submitTimeOffRequest({ user_id: 'a1b2c3d4', start_date: '2026-11-02', end_date: '2026-11-06' })

    const { init } = lastRequest()
    expect(init.method).toBe('POST')
    expect(headerOf(init, 'Content-Type')).toBe('application/json')
    expect(JSON.parse(String(init.body))).toEqual({ user_id: 'a1b2c3d4', start_date: '2026-11-02', end_date: '2026-11-06' })
    expect(accepted.executionArn).toContain(':execution:HrStateMachine:abc-123')
  })

  it('encodes path segments for leave updates and deletes', async () => {
    fetchMock.mockResolvedValue(jsonResponse(rawLeave))
    await updateLeave('a1b2c3d4', '2026-11-02', { endDate: '2026-11-07', note: '' })
    expect(lastRequest().url).toMatch(/\/employees\/a1b2c3d4\/leave\/2026-11-02$/)
    expect(lastRequest().init.method).toBe('PUT')

    fetchMock.mockResolvedValue(jsonResponse({ deleted: 'a/b' }))
    await deleteEmployee('a/b')
    expect(lastRequest().url).toMatch(/\/employees\/a%2Fb$/)
  })

  it('joins base URLs with or without a trailing slash', () => {
    expect(joinUrl('https://x.test/prod/', '/employees')).toBe('https://x.test/prod/employees')
    expect(joinUrl('https://x.test/prod', 'employees')).toBe('https://x.test/prod/employees')
  })
})

describe('runtime config (FR7.4)', () => {
  it('loads and validates config.json', async () => {
    fetchMock.mockResolvedValue(jsonResponse(testConfig))

    await expect(loadConfig(fetchMock)).resolves.toEqual(testConfig)
    expect(String(fetchMock.mock.calls[0][0])).toBe('/config.json')
  })

  it('fails with ConfigError when config.json is missing', async () => {
    fetchMock.mockResolvedValue(new Response('Not found', { status: 404 }))

    await expect(loadConfig(fetchMock)).rejects.toBeInstanceOf(ConfigError)
  })

  it('fails with ConfigError when a field is missing', async () => {
    const { agentRuntimeArn: _omitted, ...incomplete } = testConfig
    void _omitted
    fetchMock.mockResolvedValue(jsonResponse(incomplete))

    await expect(loadConfig(fetchMock)).rejects.toThrow('config.json is missing "agentRuntimeArn".')
  })
})
