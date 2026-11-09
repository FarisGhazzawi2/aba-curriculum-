interface LoadingIndicatorProps {
  label?: string
}

/** Shown as soon as a request starts (NFR5). */
export function LoadingIndicator({ label = 'Loading' }: LoadingIndicatorProps) {
  return (
    <div className="loading" role="status" aria-live="polite" data-testid="loading-indicator">
      {label}
    </div>
  )
}
