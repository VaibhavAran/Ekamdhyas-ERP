import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AttendanceMonitorPage } from './pages/AttendanceMonitorPage'
import { AttendanceRecordsPage } from './pages/AttendanceRecordsPage'
import { DashboardPage } from './pages/DashboardPage'
import { FacultyPage } from './pages/FacultyPage'
import { LoginPage } from './pages/LoginPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { StudentsPage } from './pages/StudentsPage'
import { SubjectsPage } from './pages/SubjectsPage'
import { TimetablePage } from './pages/TimetablePage'
import { DepartmentsClassesPage } from './pages/DepartmentsClassesPage'

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
          <Route path="departments-classes" element={<DepartmentsClassesPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="faculty" element={<FacultyPage />} />
          <Route path="subjects" element={<SubjectsPage />} />
          <Route path="timetable" element={<TimetablePage />} />
          <Route path="attendance-monitor" element={<AttendanceMonitorPage />} />
          <Route path="attendance-records" element={<AttendanceRecordsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
