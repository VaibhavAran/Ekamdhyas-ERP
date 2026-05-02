import { NavLink, useNavigate } from 'react-router-dom'
import {
  AiOutlineHome,
  AiOutlineUser,
  AiOutlineTeam,
  AiOutlineBook,
  AiOutlineCalendar,
  AiOutlineMonitor,
  AiOutlineFileText,
  AiOutlineBarChart,
  AiOutlineSetting,
  AiOutlineLogout,
  AiOutlineAppstore,
} from 'react-icons/ai'
import { writeAuthFlag } from '../utils/authStorage'

const navigationItems = [
  { label: 'Dashboard', to: '/dashboard', icon: AiOutlineHome },
  { label: 'Depts & Classes', to: '/departments-classes', icon: AiOutlineAppstore },
  { label: 'Students', to: '/students', icon: AiOutlineUser },
  { label: 'Faculty', to: '/faculty', icon: AiOutlineTeam },
  { label: 'Subjects', to: '/subjects', icon: AiOutlineBook },
  { label: 'Timetable', to: '/timetable', icon: AiOutlineCalendar },
  { label: 'Attendance Monitor', to: '/attendance-monitor', icon: AiOutlineMonitor },
  { label: 'Attendance Records', to: '/attendance-records', icon: AiOutlineFileText },
  { label: 'Reports', to: '/reports', icon: AiOutlineBarChart },
  { label: 'Settings', to: '/settings', icon: AiOutlineSetting },
]

export function Sidebar() {
  const navigate = useNavigate()

  const handleLogout = () => {
    writeAuthFlag(false)
    navigate('/', { replace: true })
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div>
          <p className="sidebar-brand-subtitle" style={{ color: '#64748b', fontSize: '1.4rem' }}>Admin Panel</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navigationItems.map((item) => {
          const IconComponent = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <IconComponent style={{ width: '20px', height: '20px' }} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <button className="logout-button" onClick={handleLogout}>
        <AiOutlineLogout style={{ width: '20px', height: '20px' }} />
        <span>Logout</span>
      </button>
    </aside>
  )
}