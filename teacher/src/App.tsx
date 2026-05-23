
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TimetablePage from './pages/TimetablePage';
import TakeAttendancePage from './pages/TakeAttendancePage';
import SubstituteLecturesPage from './pages/SubstituteLecturesPage';
import AttendanceRecordsPage from './pages/AttendanceRecordsPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/teacher/login" element={<LoginPage />} />
          
          <Route path="/teacher" element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/teacher/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="timetable" element={<TimetablePage />} />
              <Route path="take-attendance" element={<TakeAttendancePage />} />
              <Route path="substitute-lectures" element={<SubstituteLecturesPage />} />
              <Route path="attendance-records" element={<AttendanceRecordsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<Navigate to="/teacher/profile" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/teacher/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
