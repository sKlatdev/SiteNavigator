import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      {/* Sidebar: fixed 200px left nav */}
      <Sidebar />

      {/* Main content area: offset by sidebar width */}
      <div className="ml-[200px] flex min-h-screen flex-col">
        {/* TopBar: fixed 56px header */}
        <TopBar />

        {/* Page content: offset by topbar height */}
        <main className="mt-14 flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
