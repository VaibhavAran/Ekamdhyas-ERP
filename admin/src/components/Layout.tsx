import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-content">
        <div className="content-surface">
          <Outlet />
        </div>
      </main>
    </div>
  )
}