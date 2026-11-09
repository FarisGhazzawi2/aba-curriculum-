import { describeError } from '../api/errors'

interface ErrorMessageProps {
  error: unknown
  onRetry?: () => void
}

/** A text error (never colour alone, NFR6) with an optional retry action. */
export function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  return (
    <div className="alert alert-error" role="alert" data-testid="error-message">
      <p>{describeError(error)}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry} data-testid="error-message-retry-button">
          Try again
        </button>
      )}
    </div>
  )
}
