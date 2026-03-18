import { motion } from 'framer-motion';
import DriverRouteCard from '../components/DriverRouteCard';

export default function DriverRoute() {
    return (
        <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
        >
            <h2 className="text-xl font-bold text-slate-800">Route Info</h2>

            <DriverRouteCard />

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <h3 className="font-bold text-blue-800 mb-2">Instructions</h3>
                <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                    <li>Please reach the first stop 10 minutes early.</li>
                    <li>Maintain steady speed in campus zones.</li>
                    <li>Check student ID cards during boarding.</li>
                </ul>
            </div>
        </motion.div>
    );
}
