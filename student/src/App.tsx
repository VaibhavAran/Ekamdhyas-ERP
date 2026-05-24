import React from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AttendanceStatus from './components/AttendanceStatus';
import Analytics from './components/Analytics';
import TimeTable from './components/TimeTable';
import Profile from './components/Profile';
import LoginPage from './pages/LoginPage';
// session persistence handled by Firebase Auth; no localStorage
import type { User as UserType, AttendanceRecord } from './types';
import NotificationCenter from './components/NotificationCenter';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getAttendanceRecords, getUserById, signOutUser } from './lib/firebaseService';

const StudentPanel: React.FC<{ user: UserType; onUserUpdate: (u: UserType) => void; attendanceRecords: AttendanceRecord[] }> = ({ user, onUserUpdate, attendanceRecords }) => {
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.warn('Firebase sign out failed:', error);
    }
    // no localStorage cleanup needed; Firebase Auth handles session
    navigate('/login');
    window.location.reload(); // Hard refresh to clear memory
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <Sidebar onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto px-10 py-8 scroll-smooth relative">
        {/* Floating Bell Icon & Center */}
        <div className="absolute top-6 right-10 z-30">
          {user && <NotificationCenter userId={user.id} />}
        </div>
        
        <div className="max-w-7xl mx-auto">
          <Routes>
            <Route path="dashboard" element={<Dashboard user={user} attendanceRecords={attendanceRecords} />} />
            <Route path="attendance" element={<AttendanceStatus attendanceRecords={attendanceRecords} />} />
            <Route path="analytics" element={<Analytics attendanceRecords={attendanceRecords} />} />
            <Route path="timetable" element={<TimeTable user={user} />} />
            <Route path="profile" element={<Profile user={user} onUpdate={onUserUpdate} />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(false);
  const [user, setUser] = React.useState<UserType | null>(null);
  const [attendanceRecords, setAttendanceRecords] = React.useState<AttendanceRecord[]>([]);

  const loadAttendance = React.useCallback(async (userId: string) => {
    try {
      const records = await getAttendanceRecords(userId);
      setAttendanceRecords(records);
    } catch (error) {
      console.error('Error loading attendance records:', error);
      setAttendanceRecords([]);
    }
  }, []);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const storedUser = await getUserById(firebaseUser.uid);
        if (storedUser) {
          setUser(storedUser);
          setIsAuthenticated(true);
          await loadAttendance(storedUser.id);
        } else {
          setUser(null);
          setAttendanceRecords([]);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setAttendanceRecords([]);
        setIsAuthenticated(false);
      }
    });

    return unsubscribe;
  }, [loadAttendance]);

  React.useEffect(() => {
    if (user) {
      loadAttendance(user.id);
    }
  }, [user, loadAttendance]);

  const handleLogin = (loggedUser: UserType) => {
    // rely on Firebase Auth for persistence; keep in-memory user state
    setUser(loggedUser);
    setIsAuthenticated(true);
  };

  const handleUserUpdate = (updatedUser: UserType) => {
    setUser(updatedUser);
  };

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          isAuthenticated ? <Navigate to="/student/dashboard" replace /> : <LoginPage onLogin={handleLogin} />
        } 
      />
      <Route 
        path="/student/*" 
        element={
          isAuthenticated && user ? <StudentPanel user={user} onUserUpdate={handleUserUpdate} attendanceRecords={attendanceRecords} /> : <Navigate to="/login" replace />
        } 
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
