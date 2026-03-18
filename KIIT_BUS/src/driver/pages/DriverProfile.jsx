import { motion } from 'framer-motion';
import DriverProfileCard from '../components/DriverProfileCard';
import DriverBusCard from '../components/DriverBusCard';

export default function DriverProfile() {
    return (
        <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
        >
            <h2 className="text-xl font-bold text-slate-800">My Profile</h2>

            <DriverProfileCard />

            <div>
                <h3 className="font-bold text-slate-800 mb-3">Assigned Vehicle</h3>
                <DriverBusCard />
            </div>

            <div className="text-center">
                <button className="text-red-500 font-medium text-sm hover:text-red-600 transition-colors">
                    Sign Out
                </button>
                <p className="text-xs text-slate-400 mt-2">App Version 1.0.2</p>
            </div>
        </motion.div>
    );
}
