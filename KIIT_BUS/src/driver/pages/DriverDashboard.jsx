import { motion } from 'framer-motion';
import DriverBusCard from '../components/DriverBusCard';
import DriverRouteCard from '../components/DriverRouteCard';

export default function DriverDashboard() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
        >
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h2 className="text-xl font-bold text-slate-800">Welcome Back!</h2>
                <p className="text-slate-500 text-sm">You are on schedule for today's trip.</p>
            </div>

            <div>
                <h3 className="font-bold text-slate-800 mb-3 px-1">Current Vehicle</h3>
                <DriverBusCard />
            </div>

            <div>
                <h3 className="font-bold text-slate-800 mb-3 px-1">Route Info</h3>
                <DriverRouteCard />
            </div>

            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-100 flex items-center justify-between">
                <div>
                    <p className="text-emerald-800 font-bold text-sm">Next Stop</p>
                    <p className="text-emerald-900 font-bold text-lg">Jaydev Vihar</p>
                    <p className="text-emerald-600 text-xs">ETA: 5 min</p>
                </div>
                <div className="text-right">
                    <span className="bg-white text-emerald-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                        On Time
                    </span>
                </div>
            </div>
        </motion.div>
    );
}
