import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listEmployees, submitHrRequest, submitTimeOffRequest } from '../api/client'
import { EXECUTION_ARN, makeEmployee } from '../test/fixtures'
import { HrRequestsPage } from './HrRequestsPage'

vi.mock('../api/client', () => ({
  listEmployees: vi.fn(),
  submitTimeOffRequest: vi.fn(),
  submitHrRequest: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <HrRequestsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(listEmployees).mockReset().mockResolvedValue([makeEmployee()])
  vi.mocked(submitTimeOffRequest).mockReset()
  vi.mocked(submitHrRequest).mockReset()
})

describe('HrRequestsPage (FR4.1-FR4.4)', () => {
  it('shows the email confirmation and a reference, and no status', async () => {
    const user = userEvent.setup()
    vi.mocked(submitTimeOffRequest).mockResolvedValue({ executionArn: EXECUTION_ARN })
    renderPage()

    const form = await screen.findByTestId('time-off-form')
    await user.selectOptions(within(form).getByLabelText('Employee'), 'a1b2c3d4')
    fireEvent.change(within(form).getByLabelText('Start date'), { target: { value: '2026-11-02' } })
    fireEvent.change(within(form).getByLabelText('End date'), { target: { value: '2026-11-06' } })
    await user.click(within(form).getByTestId('time-off-form-submit-button'))

    const confirmation = await screen.findByTestId('time-off-form-confirmation')
    expect(confirmation).toHaveTextContent('Submitted. HR will receive this request by email.')
    expect(confirmation).toHaveTextContent('Reference: abc-123')
    expect(submitTimeOffRequest).toHaveBeenCalledWith({ user_id: 'a1b2c3d4', start_date: '2026-11-02', end_date: '2026-11-06' })
    expect(screen.queryByText(/status|pending|approved|rejected|in progress/i)).not.toBeInTheDocument()
  })

  it('requires an employee from the list and a valid range for time off', async () => {
    const user = userEvent.setup()
    renderPage()

    const form = await screen.findByTestId('time-off-form')
    fireEvent.change(within(form).getByLabelText('Start date'), { target: { value: '2026-11-05' } })
    fireEvent.change(within(form).getByLabelText('End date'), { target: { value: '2026-11-01' } })
    await user.click(within(form).getByTestId('time-off-form-submit-button'))

    expect(submitTimeOffRequest).not.toHaveBeenCalled()
    expect(within(form).getByText('Select an employee from the list')).toBeInTheDocument()
    expect(within(form).getByLabelText('Employee')).toHaveAttribute('aria-invalid', 'true')
    expect(within(form).getByText('End date must be on or after start date')).toBeInTheDocument()
  })

  it('sends a question with user_id and a trimmed prompt, and blocks an empty one', async () => {
    const user = userEvent.setup()
    vi.mocked(submitHrRequest).mockResolvedValue({ executionArn: EXECUTION_ARN })
    renderPage()

    const form = await screen.findByTestId('question-form')
    await user.selectOptions(within(form).getByLabelText('Employee'), 'a1b2c3d4')
    await user.click(within(form).getByTestId('question-form-submit-button'))
    expect(submitHrRequest).not.toHaveBeenCalled()
    expect(within(form).getByText('Please enter a message.')).toBeInTheDocument()

    await user.type(within(form).getByLabelText('Question'), '  How do I add a dependant?  ')
    await user.click(within(form).getByTestId('question-form-submit-button'))

    expect(submitHrRequest).toHaveBeenCalledWith({ user_id: 'a1b2c3d4', prompt: 'How do I add a dependant?' })
    expect(await screen.findByTestId('question-form-confirmation')).toHaveTextContent('HR will receive this request by email.')
  })
})
