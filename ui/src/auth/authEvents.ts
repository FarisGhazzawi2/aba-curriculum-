/*
 * A tiny event channel for "the session is no longer valid" (FR1.5).
 * The API and agent clients publish here when they raise an AuthError, and the
 * SessionExpiredBanner subscribes. It carries no token data.
 */
type AuthErrorListener = (message: string) => void

const listeners = new Set<AuthErrorListener>()

export function onAuthError(listener: AuthErrorListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyAuthError(message: string): void {
  for (const listener of listeners) {
    listener(message)
  }
}
