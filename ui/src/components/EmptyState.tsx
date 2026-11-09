import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  children?: ReactNode
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="empty-state" data-testid="empty-state">
      <p>{title}</p>
      {children}
    </div>
  )
}
