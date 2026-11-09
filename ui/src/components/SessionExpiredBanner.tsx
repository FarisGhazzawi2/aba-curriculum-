import { useEffect, useState } from 'react'
import { onAuthError } from '../auth/authEvents'

interface SessionExpiredBannerProps {
  /** Signs the user out so the Authenticator shows the sign-in form again. */
  onSignInAgain: () => void
}

/** Shown whenever an API or agent call is rejected for auth reasons (FR1.5). */
export function SessionExpiredBanner({ onSignInAgain }: SessionExpiredBannerProps) {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => onAuthError(setMessage), [])

  if (!message) {
    return null
  }

  return (
    <div className="banner" role="alert" data-testid="session-expired-banner">
      <div className="banner-inner">
        <span>{message}</span>
        <button
          type="button"
          className="btn btn-danger"
          onClick={onSignInAgain}
          data-testid="session-expired-banner-sign-in-button"
        >
          Sign in again
        </button>
      </div>
    </div>
  )
}
