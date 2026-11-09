import { notifyAuthError } from '../auth/authEvents'

export const SESSION_EXPIRED_MESSAGE =
  'Your session has expired or you do not have access. Please sign in again.'

/** The API or agent rejected the credentials (401/403), or no valid session exists. */
export class AuthError extends Error {
  readonly status: number | undefined

  constructor(message: string = SESSION_EXPIRED_MESSAGE, status?: number, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AuthError'
    this.status = status
  }
}

/** The API answered with a non-2xx status other than 401/403. */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** The request never reached the API (offline, DNS, blocked by CORS). */
export class NetworkError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'NetworkError'
  }
}

/** Creates an AuthError and tells the session banner about it. */
export function raiseAuthError(status?: number, options?: ErrorOptions): AuthError {
  const error = new AuthError(SESSION_EXPIRED_MESSAGE, status, options)
  notifyAuthError(error.message)
  return error
}

/** A user-facing message for any error thrown by the clients. */
export function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Something went wrong. Please try again.'
}
