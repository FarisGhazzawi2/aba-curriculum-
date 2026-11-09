import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmployee, getEmployee, updateEmployee } from '../api/client'
import { ApiError } from '../api/errors'
import { makeEmployee } from '../test/fixtures'
import { EmployeeForm } from './EmployeeForm'

vi.mock('../api/client', () => ({
  createEmployee: vi.fn(),
  getEmployee: vi.fn(),
  updateEmployee: vi.fn(),
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/employees/new" element={<EmployeeForm />} />
        <Route path="/employees/:id/edit" element={<EmployeeForm />} />
        <Route path="/employees/:id" element={<p>Detail page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(createEmployee).mockReset()
  vi.mocked(getEmployee).mockReset()
  vi.mocked(updateEmployee).mockReset()
})

describe('EmployeeForm (FR2.4, FR2.5)', () => {
  it('blocks an empty name and flags the field', async () => {
    const user = userEvent.setup()
    renderAt('/employees/new')

    await user.type(screen.getByLabelText('Department'), 'Engineering')
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2024-01-15' } })
    await user.click(screen.getByTestId('employee-form-submit-button'))

    expect(createEmployee).not.toHaveBeenCalled()
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Name')).toHaveFocus()
  })

  it('creates an employee with the default role and opens its page', async () => {
    const user = userEvent.setup()
    vi.mocked(createEmployee).mockResolvedValue(makeEmployee())
    renderAt('/employees/new')

    await user.type(screen.getByLabelText('Name'), '  Ada Lovelace ')
    await user.type(screen.getByLabelText('Department'), 'Engineering')
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2024-01-15' } })
    await user.click(screen.getByTestId('employee-form-submit-button'))

    expect(createEmployee).toHaveBeenCalledWith({
      name: 'Ada Lovelace',
      department: 'Engineering',
      startDate: '2024-01-15',
      role: 'employee',
    })
    expect(await screen.findByText('Detail page')).toBeInTheDocument()
  })

  it('loads the employee for editing and saves with PUT', async () => {
    const user = userEvent.setup()
    vi.mocked(getEmployee).mockResolvedValue(makeEmployee())
    vi.mocked(updateEmployee).mockResolvedValue(makeEmployee({ department: 'Research' }))
    renderAt('/employees/a1b2c3d4/edit')

    const department = await screen.findByLabelText('Department')
    expect(department).toHaveValue('Engineering')
    await user.clear(department)
    await user.type(department, 'Research')
    await user.click(screen.getByTestId('employee-form-submit-button'))

    expect(updateEmployee).toHaveBeenCalledWith('a1b2c3d4', expect.objectContaining({ department: 'Research' }))
  })

  it('keeps the form and shows the error when saving fails', async () => {
    const user = userEvent.setup()
    vi.mocked(createEmployee).mockRejectedValue(new ApiError('Input should be a valid date', 422))
    renderAt('/employees/new')

    await user.type(screen.getByLabelText('Name'), 'Ada Lovelace')
    await user.type(screen.getByLabelText('Department'), 'Engineering')
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2024-01-15' } })
    await user.click(screen.getByTestId('employee-form-submit-button'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Input should be a valid date')
    expect(screen.getByLabelText('Name')).toHaveValue('Ada Lovelace')
  })
})
