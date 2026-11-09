import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { AssistantPage } from './pages/AssistantPage'
import { EmployeeDetailPage } from './pages/EmployeeDetailPage'
import { EmployeeForm } from './pages/EmployeeForm'
import { EmployeesPage } from './pages/EmployeesPage'
import { HrRequestsPage } from './pages/HrRequestsPage'
import { NotFoundPage } from './pages/NotFoundPage'

interface AppProps {
  onSignOut: () => void
}

/** Routes, rendered only after sign-in (FR1.1). */
export default function App({ onSignOut }: AppProps) {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout onSignOut={onSignOut} />}>
          <Route index element={<Navigate to="/employees" replace />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="employees/new" element={<EmployeeForm />} />
          <Route path="employees/:id" element={<EmployeeDetailPage />} />
          <Route path="employees/:id/edit" element={<EmployeeForm />} />
          <Route path="requests" element={<HrRequestsPage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
