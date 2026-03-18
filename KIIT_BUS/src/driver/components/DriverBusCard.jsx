import { Bus, Navigation } from 'lucide-react';
import Card from '../../components/ui/Card';

export default function DriverBusCard({ busNumber = "OD-02-BA-1234", busName = "Kiit Bus 42", routeName = "Campus 15 - Campus 3" }) {
    return (
        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-none shadow-blue-500/30">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-blue-100 text-xs font-medium uppercase tracking-wider mb-1">Assigned Vehicle</p>
                    <h3 className="text-2xl font-bold">{busNumber}</h3>
                    <p className="text-blue-100 opacity-90">{busName}</p>
                </div>
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                    <Bus size={20} className="text-white" />
                </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex items-center gap-3">
                <Navigation size={18} className="text-blue-200" />
                <div>
                    <p className="text-[10px] text-blue-200 uppercase font-bold">Current Route</p>
                    <p className="font-semibold text-sm">{routeName}</p>
                </div>
            </div>
        </Card>
    );
}
