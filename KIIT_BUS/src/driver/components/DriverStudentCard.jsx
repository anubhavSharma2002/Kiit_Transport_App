import { User, Phone } from 'lucide-react';
import Card from '../../components/ui/Card';

export default function DriverStudentCard({ name, stop, phone, id }) {
    return (
        <Card className="bg-white border-slate-100 shadow-sm p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <User size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-sm text-slate-800">{name}</h4>
                    <p className="text-xs text-slate-500">Stop: {stop}</p>
                </div>
            </div>

            <a href={`tel:${phone}`} className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors">
                <Phone size={18} />
            </a>
        </Card>
    );
}
