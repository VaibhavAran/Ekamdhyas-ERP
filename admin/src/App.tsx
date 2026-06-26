import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { SettingsPage } from './pages/SettingsPage'
import { StudentsPage } from './pages/StudentsPage'
import { SubjectsPage } from './pages/SubjectsPage'
import { DepartmentsClassesPage } from './pages/DepartmentsClassesPage'
import { AcademicYearsPage } from './pages/AcademicYearsPage'
import { BoardsPage } from './pages/BoardsPage'
import { TeachersPage } from './pages/TeachersPage'
import { AttendanceAnalyticsPage } from './pages/AttendanceAnalyticsPage'
import { NoticeManagementPage } from './pages/NoticeManagementPage'
import { AssignmentsPage } from './pages/AssignmentsPage'
import { ReportsAnalyticsPage } from './pages/ReportsAnalyticsPage'
import { UserManagementPage } from './pages/UserManagementPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="classes-branches" element={<DepartmentsClassesPage />} />
          <Route path="academic-years" element={<AcademicYearsPage />} />
          <Route path="boards" element={<BoardsPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="teachers" element={<TeachersPage />} />
          <Route path="subjects" element={<SubjectsPage />} />
          <Route path="attendance-analytics" element={<AttendanceAnalyticsPage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="reports-analytics" element={<ReportsAnalyticsPage />} />
          <Route path="notices" element={<NoticeManagementPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="user-management" element={<UserManagementPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
