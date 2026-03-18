import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Bus, Building2, Users, FileText, Map, BrainCircuit, LogOut, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import API_BASE from '../apiBase';

export default function AdminSidebar({ isOpen, onClose }) {
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            window.location.href = '/';
        } catch (error) {
            console.error("Logout failed", error);
            window.location.href = '/';
        }
    };

    const links = [
        { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
        { name: 'Vehicles', path: '/admin/vehicles', icon: Bus },
        { name: 'Hostels', path: '/admin/hostels', icon: Building2 },
        { name: 'Drivers', path: '/admin/drivers', icon: Users },
        { name: 'Reports', path: '/admin/reports', icon: FileText },
        { name: 'Live Map', path: '/admin/live-map', icon: Map },
        { name: 'ML Insights', path: '/admin/ml', icon: BrainCircuit },
    ];

    const isActive = (path) => {
        if (path === '/admin' && location.pathname === '/admin') return true;
        if (path !== '/admin' && location.pathname.startsWith(path)) return true;
        return false;
    };

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-slate-800 text-white">
            <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Bus className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">KiitAdmin</span>
                </div>
                <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white">
                    <X size={24} />
                </button>
            </div>

            <div className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
                {links.map((link) => {
                    const Icon = link.icon;
                    const active = isActive(link.path);
                    return (
                        <Link
                            key={link.path}
                            to={link.path}
                            onClick={onClose}
                            className={`
                                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                                ${active
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                                    : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                                }
                            `}
                        >
                            <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                            <span className={`font-medium ${active ? 'font-semibold' : ''}`}>{link.name}</span>
                        </Link>
                    );
                })}
            </div>

            <div className="p-4 border-t border-slate-700">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                >
                    <LogOut size={20} />
                    <span className="font-medium">Logout</span>
                </button>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden md:block w-72 h-screen sticky top-0 border-r border-slate-200 shadow-xl bg-slate-800 z-40">
                <SidebarContent />
            </div>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-50 md:hidden"
                        onClick={onClose}
                    >
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                            className="absolute left-0 top-0 bottom-0 w-3/4 max-w-xs bg-slate-800 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <SidebarContent />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}