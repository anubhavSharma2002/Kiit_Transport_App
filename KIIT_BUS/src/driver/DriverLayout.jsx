import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Map, User } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DriverLayout() {
    const location = useLocation();

    const navItems = [
        { label: 'Home', path: '/driver', icon: LayoutDashboard },
        { label: 'Students', path: '/driver/students', icon: Users },
        { label: 'Route', path: '/driver/route', icon: Map },
        { label: 'Profile', path: '/driver/profile', icon: User },
    ];

    const isActive = (path) => {
        if (path === '/driver' && location.pathname === '/driver') return true;
        if (path !== '/driver' && location.pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Mobile Top Bar */}
            <div className="bg-primary text-white p-4 sticky top-0 z-30 shadow-md">
                <h1 className="text-lg font-bold">Driver Portal</h1>
            </div>

            {/* Main Content Area */}
            <div className="p-4">
                <Outlet />
            </div>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe pt-1 px-4 z-50 pb-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between items-end">
                    {navItems.map((item) => {
                        const active = isActive(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex flex-col items-center gap-1 p-2 w-full transition-all duration-300 relative ${active ? 'text-primary' : 'text-slate-400'
                                    }`}
                            >
                                {active && (
                                    <motion.div
                                        layoutId="driver-nav-indicator"
                                        className="absolute -top-3 w-8 h-1 bg-primary rounded-full"
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                )}
                                <item.icon size={active ? 24 : 22} strokeWidth={active ? 2.5 : 2} />
                                <span className={`text-[10px] font-medium ${active ? 'font-bold' : ''}`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
