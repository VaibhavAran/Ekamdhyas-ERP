
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = () => {
  const { currentUser, teacherProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!currentUser || !teacherProfile || teacherProfile.role !== 'teacher') {
    return <Navigate to="/teacher/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
