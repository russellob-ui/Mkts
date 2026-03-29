import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import SideNav from './SideNav'
import BottomNav from './BottomNav'

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-navy-900">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:flex-col md:w-56 lg:w-60 flex-shrink-0 border-r border-navy-800">
          <SideNav />
        </aside>
        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6 px-4 md:px-6 py-4">
          <Outlet />
        </main>
      </div>
      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  )
}
