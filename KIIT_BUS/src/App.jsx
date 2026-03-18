import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'

// Student pages
import Dashboard from './pages/Dashboard'
import SelectRoute from './pages/SelectRoute'
import LiveTracking from './pages/LiveTracking'
import RoutesPage from './pages/Routes'
import Support from './pages/Support'
import Complaints from './pages/Complaints'

// Admin pages
import AdminDashboard from './admin/AdminDashboard'
import Vehicles from './admin/Vehicles'
import Hostels from './admin/Hostels'
import Drivers from './admin/Drivers'
import Reports from './admin/Reports'
import LiveMap from './admin/LiveMap'
import MLPredictions from './admin/MLPredictions'
import AdminLogin from './admin/AdminLogin'
import AdminGuard from './admin/AdminGuard'

// Driver Pages
import DriverLayout from './driver/DriverLayout'
import DriverDashboard from './driver/pages/DriverDashboard'
import DriverStudents from './driver/pages/DriverStudents'
import DriverRoute from './driver/pages/DriverRoute'
import DriverProfile from './driver/pages/DriverProfile'

function AppContent() {
  const location = useLocation();
  const isDriverRoutes = location.pathname.startsWith('/driver');
  const isAdminRoutes = location.pathname.startsWith('/admin');

  const showPadding = !isDriverRoutes && !isAdminRoutes;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">

      {/* Navbar only for student routes */}
      {!isDriverRoutes && !isAdminRoutes && <Navbar />}

      <main className={`flex-1 ${showPadding ? 'pt-16 md:pt-20 px-4 md:px-8' : ''}`}>
        <div className={`${showPadding ? 'max-w-7xl mx-auto' : ''}`}>
          <Routes>

            {/* STUDENT ROUTES */}
            <Route path="/" element={<SelectRoute />} />
            <Route path="/live-tracking" element={<LiveTracking />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/support" element={<Support />} />
            <Route path="/complaints" element={<Complaints />} />

            {/* ADMIN LOGIN */}
            <Route path="/admin/login" element={<AdminLogin />} />

            <Route path="/admin" element={<AdminGuard />}>
              <Route index element={<AdminDashboard />} />
              <Route path="vehicles" element={<Vehicles />} />
              <Route path="hostels" element={<Hostels />} />
              <Route path="drivers" element={<Drivers />} />
              <Route path="reports" element={<Reports />} />
              <Route path="live-map" element={<LiveMap />} />
              <Route path="ml" element={<MLPredictions />} />
            </Route>

            {/* DRIVER PORTAL */}
            <Route path="/driver" element={<DriverLayout />}>
              <Route index element={<DriverDashboard />} />
              <Route path="students" element={<DriverStudents />} />
              <Route path="route" element={<DriverRoute />} />
              <Route path="profile" element={<DriverProfile />} />
            </Route>

          </Routes>
        </div>
      </main>

      {!isDriverRoutes && !isAdminRoutes && <Footer />}

    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}