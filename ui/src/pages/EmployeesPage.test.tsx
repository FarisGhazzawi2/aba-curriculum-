import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listEmployees } from '../api/client'
import { ApiError } from '../api/errors'
import { makeEmployee } from '../test/fixtures'
import { EmployeesPage } from './EmployeesPage'

vi.mock('../api/client', () => ({
  listEmployees: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <EmployeesPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(listEmployees).mockReset()
})

describe('EmployeesPage (FR2.1, FR2.2)', () => {
  it('renders a row per employee with name, department, start date and role', async () => {
    vi.mocked(listEmployees).mockResolvedValue([
      makeEmployee(),
      makeEmployee({ employeeId: 'e5f6a7b8', name: 'Grace Hopper', department: 'Research', startDate: '2023-06-01', role: 'manager' }),
    ])

    renderPage()

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    const rows = await screen.findAllByTestId('employees-table-row')
    expect(rows).toHaveLength(2)
    expect(within(rows[1]).getByText('Grace Hopper')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Research')).toBeInTheDocument()
    expect(within(rows[1]).getByText('2023-06-01')).toBeInTheDocument()
    expect(within(rows[1]).getByText('manager')).toBeInTheDocument()
    expect(screen.queryByText('USER')).not.toBeInTheDocument()
  })

  it('disables Apply and explains why when only one hire date is set', async () => {
    vi.mocked(listEmployees).mockResolvedValue([])
    renderPage()
    await screen.findByTestId('empty-state')

    fireEvent.change(screen.getByLabelText('Hired from'), { target: { value: '2024-01-01' } })

    expect(screen.getByTestId('employees-filter-apply-button')).toBeDisabled()
    expect(screen.getByTestId('employees-filter-hint')).toHaveTextContent('Both dates are required to filter by hire date.')
  })

  it('sends the filter once both dates are set', async () => {
    vi.mocked(listEmployees).mockResolvedValue([])
    renderPage()
    await screen.findByTestId('empty-state')

    fireEvent.change(screen.getByLabelText('Hired from'), { target: { value: '2024-01-01' } })
    fireEvent.change(screen.getByLabelText('Hired to'), { target: { value: '2024-12-31' } })
    fireEvent.click(screen.getByTestId('employees-filter-apply-button'))

    await screen.findByText('No employees were hired in this date range.')
    expect(listEmployees).toHaveBeenLastCalledWith({ hiredFrom: '2024-01-01', hiredTo: '2024-12-31' })
  })

  it('shows the API error with a retry action', async () => {
    vi.mocked(listEmployees).mockRejectedValueOnce(new ApiError('The HR API had a problem (HTTP 500). Please try again.', 500))
    vi.mocked(listEmployees).mockResolvedValueOnce([makeEmployee()])
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 500')
    fireEvent.click(screen.getByTestId('error-message-retry-button'))

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
  })
})
