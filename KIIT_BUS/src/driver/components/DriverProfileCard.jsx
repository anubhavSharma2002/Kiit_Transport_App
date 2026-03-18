import { User, Phone, BadgeCheck, Mail } from 'lucide-react';
import Card from '../../components/ui/Card';

export default function DriverProfileCard({
    name = "Rajesh Kumar",
    id = "DRV-2024-001",
    phone = "+91 98765 43210",
    email = "rajesh.k@kiit.ac.in"
}) {
    return (
        <Card className="bg-white border-slate-100 shadow-sm text-center pt-8 pb-6">
            <div className="w-20 h-20 bg-slate-200 rounded-full mx-auto mb-4 flex items-center justify-center text-slate-500 ring-4 ring-slate-50">
                <User size={40} />
            </div>

            <h3 className="text-xl font-bold text-slate-800">{name}</h3>
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium mt-1">
                <BadgeCheck size={12} /> Verified Driver
            </span>
            <p className="text-slate-400 text-xs mt-1 mb-6">ID: {id}</p>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 text-left">
                <div>
                    <p className="text-xs text-slate-400 mb-1">Phone Number</p>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Phone size={14} className="text-blue-500" />
                        {phone}
                    </div>
                </div>
                <div>
                    <p className="text-xs text-slate-400 mb-1">Email Address</p>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700 truncate">
                        <Mail size={14} className="text-blue-500" />
                        <span className="truncate">{email}</span>
                    </div>
                </div>
            </div>
        </Card>
    );
}
