import { Link, useLocation } from 'react-router-dom';
import { Home, MapPin, Navigation, LifeBuoy, AlertCircle, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Navbar() {
  const location = useLocation();
  const isExcluded =
    location.pathname.startsWith('/admin') ||
    location.pathname === '/admin/login' ||
    location.pathname.startsWith('/driver');

  if (isExcluded) return null;

  const navItems = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Live', path: '/live-tracking', icon: MapPin },
    { label: 'Routes', path: '/routes', icon: Navigation },
    { label: 'Support', path: '/support', icon: LifeBuoy },
    { label: 'Complaints', path: '/complaints', icon: AlertCircle },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* ================= DESKTOP NAV ================= */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-[2000] bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              🚌
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-blue-600">
              KIIT Transit
            </span>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-full border border-slate-200/50">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  isActive(item.path)
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-slate-200/50'
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            ))}
          </div>

          {/* Admin Button */}
          <Link
            to="/admin/login"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-slate-800 text-white hover:bg-slate-900 transition-colors shadow-lg shadow-slate-900/10"
          >
            <LogIn size={16} />
            Admin
          </Link>
        </div>
      </nav>

      {/* ================= MOBILE TOP BAR ================= */}
      <nav className="md:hidden fixed top-0 left-0 right-0 z-[2000] h-14 flex items-center justify-between px-4 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            🚌
          </div>
          <span className="font-bold text-lg text-slate-800">Transit</span>
        </Link>

        <Link
          to="/admin/login"
          className="p-2 bg-slate-100 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition"
        >
          <LogIn size={20} />
        </Link>
      </nav>

      {/* ================= MOBILE BOTTOM NAV ================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[2000] bg-white border-t border-slate-200 pb-5">
        <div className="flex justify-between items-end px-3 pt-2">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 p-2 w-full transition-all duration-300 relative ${
                  active
                    ? 'text-blue-600 transform -translate-y-2'
                    : 'text-slate-400'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-3 w-8 h-1 bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                  />
                )}

                <item.icon size={active ? 24 : 22} strokeWidth={active ? 2.5 : 2} />
                <span className={`text-[10px] font-medium ${active ? 'opacity-100' : 'opacity-80'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}