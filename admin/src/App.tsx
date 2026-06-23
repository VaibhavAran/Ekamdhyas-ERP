import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AttendanceRecordsPage } from './pages/AttendanceRecordsPage'
import { DashboardPage } from './pages/DashboardPage'
import { FacultyPage } from './pages/FacultyPage'
import { LoginPage } from './pages/LoginPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { SettingsPage } from './pages/SettingsPage'
import { StudentsPage } from './pages/StudentsPage'
import { SubjectsPage } from './pages/SubjectsPage'
import { TimetablePage } from './pages/TimetablePage'
import { DepartmentsClassesPage } from './pages/DepartmentsClassesPage'
import { AcademicYearsPage } from './pages/AcademicYearsPage'
import { BoardsPage } from './pages/BoardsPage'

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
          <Route path="faculty" element={<FacultyPage />} />
          <Route path="subjects" element={<SubjectsPage />} />
          <Route path="timetable" element={<TimetablePage />} />
          <Route path="attendance-records" element={<AttendanceRecordsPage />} />
          {/* Reports page removed */}
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
