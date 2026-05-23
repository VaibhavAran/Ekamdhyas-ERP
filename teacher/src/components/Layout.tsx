
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { FiHome, FiCalendar, FiCheckSquare, FiArchive, FiBell, FiUser, FiLogOut, FiRefreshCw } from 'react-icons/fi';

const Layout = () => {
  const { teacherProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/teacher/login');
  };

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900/50 flex flex-col border-r border-slate-800">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Teacher Panel</h2>
          <p className="text-sm text-slate-400 mt-1">{teacherProfile?.name}</p>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
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
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />
        <div className="p-8 pb-12 flex-1 overflow-y-auto z-10 w-full relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
