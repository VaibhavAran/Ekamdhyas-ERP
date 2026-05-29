
import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { FiHome, FiCalendar, FiCheckSquare, FiArchive, FiBell, FiUser, FiLogOut, FiRefreshCw, FiMenu, FiX } from 'react-icons/fi';

const Layout = () => {
  const { teacherProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/teacher/login');
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const navItems = [
    { name: 'Dashboard', path: '/teacher/dashboard', icon: FiHome },
    { name: 'Timetable', path: '/teacher/timetable', icon: FiCalendar },
    { name: 'Take Attendance', path: '/teacher/take-attendance', icon: FiCheckSquare },
    { name: 'Substitute Lectures', path: '/teacher/substitute-lectures', icon: FiRefreshCw },
    { name: 'Attendance Records', path: '/teacher/attendance-records', icon: FiArchive },
    { name: 'Notifications', path: '/teacher/notifications', icon: FiBell },
    { name: 'Profile', path: '/teacher/profile', icon: FiUser },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100 font-sans lg:flex">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      {/* Sidebar */}
      <aside className={`teacher-layout-sidebar fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800 bg-slate-900/95 transition-transform duration-300 ease-out lg:static lg:w-64 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-start justify-between gap-3 lg:block">
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Teacher Panel</h2>
              <p className="text-sm text-slate-400 mt-1">{teacherProfile?.name}</p>
            </div>
            <button
              type="button"
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-2 text-slate-300 lg:hidden"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 text-blue-400 border border-blue-500/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
          >
            <FiLogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <div className="teacher-layout-mobilebar sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm font-semibold text-slate-100"
          >
            <FiMenu className="h-5 w-5" />
            Menu
          </button>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Teacher Panel</p>
            <p className="text-sm font-semibold text-white">{teacherProfile?.name}</p>
          </div>
        </div>
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />
        <div className="relative z-10 flex-1 overflow-y-auto p-4 pb-12 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
