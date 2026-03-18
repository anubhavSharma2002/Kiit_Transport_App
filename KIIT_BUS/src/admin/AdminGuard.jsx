import { Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import API_BASE from '../apiBase'
import AdminSidebar from '../components/AdminSidebar'
import { Menu } from 'lucide-react'

export default function AdminGuard() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch(`${API_BASE}/me`, {
          credentials: 'include'
        })

        if (!res.ok) {
          setIsAdmin(false)
          setLoading(false)
          return
        }

        const data = await res.json()

        if (data.role === 'admin') {
          setIsAdmin(true)
        }

        setLoading(false)
      } catch {
        setIsAdmin(false)
        setLoading(false)
      }
    }

    checkAdmin()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-slate-600 font-medium">Verifying Access...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 w-full min-w-0 transition-all duration-300">
        {/* Mobile Header to toggle Sidebar */}
        <div className="md:hidden h-16 bg-white border-b border-slate-200 flex items-center px-4 justify-between sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-slate-600 hover:text-primary">
            <Menu size={24} />
          </button>
          <span className="font-bold text-lg text-secondary">Admin Panel</span>
          <div className="w-8" /> {/* Spacer for centering */}
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
