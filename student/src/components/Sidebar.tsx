import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  UserCircle, 
  CalendarCheck, 
  BarChart3, 
  Table2, 
  LogOut,
  GraduationCap
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/student/dashboard' },
    { icon: CalendarCheck, label: 'Attendance', path: '/student/attendance' },
    { icon: BarChart3, label: 'Analytics', path: '/student/analytics' },
    { icon: Table2, label: 'Time Table', path: '/student/timetable' },
    { icon: UserCircle, label: 'Profile', path: '/student/profile' },
  ];

  return (
    <div className="flex h-screen w-64 flex-col bg-white border-r border-gray-200">
      <div className="flex flex-col items-center py-8 px-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="p-2 bg-blue-600 rounded-lg">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight leading-tight">Student Panel</span>
        </div>
        
        <nav className="w-full space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                  isActive 
                    ? "bg-blue-50 text-blue-600 shadow-sm" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-gray-100">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-colors duration-200"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
