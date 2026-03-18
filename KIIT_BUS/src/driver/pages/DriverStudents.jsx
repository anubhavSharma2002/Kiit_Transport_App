import { motion } from 'framer-motion';
import DriverStudentCard from '../components/DriverStudentCard';

export default function DriverStudents() {
    // Mock Data
    const students = [
        { id: 1, name: "Rahul Sharma", stop: "Patia Chowk", phone: "9876543210" },
        { id: 2, name: "Priya Patel", stop: "Jaydev Vihar", phone: "9876543211" },
        { id: 3, name: "Amit Kumar", stop: "Master Canteen", phone: "9876543212" },
        { id: 4, name: "Sneha Gupta", stop: "Rasulgarh", phone: "9876543213" },
        { id: 5, name: "Vikram Singh", stop: "Fire Station", phone: "9876543214" },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
        >
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">My Students</h2>
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                    {students.length} Total
                </span>
            </div>

            <div className="space-y-3">
                {students.map(student => (
                    <DriverStudentCard key={student.id} {...student} />
                ))}
            </div>
        </motion.div>
    );
}
