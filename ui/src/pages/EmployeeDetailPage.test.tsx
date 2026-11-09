import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLeave, deleteEmployee, getEmployee, listLeave, updateLeave } from '../api/client'
import { ApiError } from '../api/errors'
import { makeEmployee, makeLeave } from '../test/fixtures'
import { EmployeeDetailPage } from './EmployeeDetailPage'

vi.mock('../api/client', () => ({
  getEmployee: vi.fn(),
  deleteEmployee: vi.fn(),
  listLeave: vi.fn(),
  createLeave: vi.fn(),
  updateLeave: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/employees/a1b2c3d4']}>
      <Routes>
        <Route path="/employees/:id" element={<EmployeeDetailPage />} />
        <Route path="/employees" element={<p>Employee list</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  for (const fn of [getEmployee, deleteEmployee, listLeave, createLeave, updateLeave]) {
    vi.mocked(fn).mockReset()
  }
  vi.mocked(getEmployee).mockResolvedValue(makeEmployee())
  vi.mocked(listLeave).mockResolvedValue([makeLeave()])
})

describe('EmployeeDetailPage delete (FR2.3, FR2.6)', () => {
  it('names the employee in the confirmation and sends nothing on cancel', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByTestId('employee-detail-delete-button'))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Ada Lovelace')).toBeInTheDocument()
    await user.click(within(dialog).getByTestId('confirm-dialog-cancel-button'))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleteEmployee).not.toHaveBeenCalled()
  })

  it('deletes after confirmation and returns to the list', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteEmployee).mockResolvedValue({ deleted: 'a1b2c3d4' })
    renderPage()

    await user.click(await screen.findByTestId('employee-detail-delete-button'))
    await user.click(screen.getByTestId('confirm-dialog-confirm-button'))

    expect(deleteEmployee).toHaveBeenCalledWith('a1b2c3d4')
    expect(await screen.findByText('Employee list')).toBeInTheDocument()
  })

  it('shows "Employee not found" on a 404', async () => {
    vi.mocked(getEmployee).mockRejectedValue(new ApiError('Employee not found', 404))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Employee not found')
  })
})

describe('Leave section (FR3.1-FR3.4)', () => {
  it('blocks an end date before the start date', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('leave-table')

    fireEvent.change(screen.getByTestId('leave-add-start-input'), { target: { value: '2026-11-05' } })
    fireEvent.change(screen.getByTestId('leave-add-end-input'), { target: { value: '2026-11-01' } })
    await user.click(screen.getByTestId('leave-add-submit-button'))

    expect(createLeave).not.toHaveBeenCalled()
    expect(screen.getByText('End date must be on or after start date')).toBeInTheDocument()
  })

  it('adds a valid leave entry and reloads the list', async () => {
    const user = userEvent.setup()
    vi.mocked(createLeave).mockResolvedValue(makeLeave({ startDate: '2026-12-01', endDate: '2026-12-01', note: '' }))
    renderPage()
    await screen.findByTestId('leave-table')

    fireEvent.change(screen.getByTestId('leave-add-start-input'), { target: { value: '2026-12-01' } })
    fireEvent.change(screen.getByTestId('leave-add-end-input'), { target: { value: '2026-12-01' } })
    await user.click(screen.getByTestId('leave-add-submit-button'))

    expect(createLeave).toHaveBeenCalledWith('a1b2c3d4', { startDate: '2026-12-01', endDate: '2026-12-01', note: '' })
    await vi.waitFor(() => expect(listLeave).toHaveBeenCalledTimes(2))
  })

  it('edits end date and note with the start date read-only, and offers no delete', async () => {
    const user = userEvent.setup()
    vi.mocked(updateLeave).mockResolvedValue(makeLeave({ endDate: '2026-11-07' }))
    renderPage()

    const table = await screen.findByTestId('leave-table')
    expect(within(table).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()

    await user.click(within(table).getByTestId('leave-table-row-edit-button'))
    expect(screen.getByLabelText('Start date (read-only)')).toHaveAttribute('readonly')
    fireEvent.change(screen.getByTestId('leave-edit-end-input'), { target: { value: '2026-11-07' } })
    await user.click(screen.getByTestId('leave-edit-save-button'))

    expect(updateLeave).toHaveBeenCalledWith('a1b2c3d4', '2026-11-02', { endDate: '2026-11-07', note: 'Family visit' })
    await vi.waitFor(() => expect(listLeave).toHaveBeenCalledTimes(2))
    expect(await screen.findByTestId('leave-table-row')).toBeInTheDocument()
  })
})
