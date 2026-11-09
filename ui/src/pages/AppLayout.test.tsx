import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { notifyAuthError } from '../auth/authEvents'
import { SESSION_EXPIRED_MESSAGE } from '../api/errors'
import { AppLayout } from '../components/AppLayout'

function renderLayout(onSignOut = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/requests']}>
      <Routes>
        <Route element={<AppLayout onSignOut={onSignOut} />}>
          <Route path="requests" element={<p>Requests content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
  return onSignOut
}

describe('AppLayout (FR8.1, FR8.4, FR1.4)', () => {
  it('uses the text wordmark and the app navigation, with no starter content', () => {
    renderLayout()

    expect(screen.getByTestId('app-header-wordmark-link')).toHaveTextContent('HR Leave Portal')
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
    expect(screen.getByTestId('app-nav-employees-link')).toHaveTextContent('Employees')
    expect(screen.getByTestId('app-nav-requests-link')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('app-nav-assistant-link')).toHaveTextContent('Assistant')
    expect(screen.getByText('Requests content')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText(/get started|count is|vite|react logo/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/rolex/i)).not.toBeInTheDocument()
  })

  it('signs out from the header', async () => {
    const onSignOut = renderLayout()

    await userEvent.setup().click(screen.getByTestId('app-header-sign-out-button'))

    expect(onSignOut).toHaveBeenCalledTimes(1)
  })
})

describe('SessionExpiredBanner (FR1.5)', () => {
  it('appears on an AuthError and offers to sign in again', async () => {
    const onSignOut = renderLayout()
    expect(screen.queryByTestId('session-expired-banner')).not.toBeInTheDocument()

    act(() => notifyAuthError(SESSION_EXPIRED_MESSAGE))

    expect(screen.getByTestId('session-expired-banner')).toHaveTextContent('Your session has expired')
    await userEvent.setup().click(screen.getByTestId('session-expired-banner-sign-in-button'))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })
})
