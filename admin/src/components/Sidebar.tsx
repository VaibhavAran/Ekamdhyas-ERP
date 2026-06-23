import { NavLink, useNavigate } from 'react-router-dom'
import {
  AiOutlineHome,
  AiOutlineUser,
  AiOutlineTeam,
  AiOutlineBook,
  AiOutlineCalendar,
  AiOutlineFileText,
  AiOutlineSetting,
  AiOutlineLogout,
  AiOutlineAppstore,
  AiOutlineSchedule,
  AiOutlineClose,
} from 'react-icons/ai'
import { writeAuthFlag } from '../utils/authStorage'

const navigationItems = [
  { label: 'Dashboard', to: '/dashboard', icon: AiOutlineHome },
  { label: 'Academic Year', to: '/academic-years', icon: AiOutlineCalendar },
  { label: 'Board Management', to: '/boards', icon: AiOutlineAppstore },
  { label: 'Classes', to: '/classes-branches', icon: AiOutlineAppstore },
  { label: 'Students', to: '/students', icon: AiOutlineUser },
  { label: 'Faculty', to: '/faculty', icon: AiOutlineTeam },
  { label: 'Subjects', to: '/subjects', icon: AiOutlineBook },
  { label: 'Timetable', to: '/timetable', icon: AiOutlineSchedule },
  { label: 'Attendance Records', to: '/attendance-records', icon: AiOutlineFileText },
  { label: 'Settings', to: '/settings', icon: AiOutlineSetting },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate()

  const handleLogout = () => {
    writeAuthFlag(false)
    navigate('/', { replace: true })
  }

  const handleNavClick = () => {
    onClose()
  }

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand">
        <div>
          <p className="sidebar-brand-subtitle" style={{ color: '#64748b', fontSize: '1.4rem' }}>School Panel</p>
        </div>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
          <AiOutlineClose size={22} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {navigationItems.map((item) => {
          const IconComponent = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleNavClick}
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
