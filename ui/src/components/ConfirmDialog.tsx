import { useEffect, useId, useRef, type ReactNode } from 'react'

interface ConfirmDialogProps {
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  isBusy?: boolean
}

/** A modal confirmation. Focus starts on Cancel and Escape cancels (NFR6). */
export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel, isBusy = false }: ConfirmDialogProps) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <div
      className="dialog-backdrop"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !isBusy) onCancel()
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="confirm-dialog">
        <h2 id={titleId}>{title}</h2>
        {children}
        <div className="button-row">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isBusy}
            data-testid="confirm-dialog-cancel-button"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isBusy}
            data-testid="confirm-dialog-confirm-button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
