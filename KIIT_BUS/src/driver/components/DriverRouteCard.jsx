import { MapPin, Clock } from 'lucide-react';
import Card from '../../components/ui/Card';

export default function DriverRouteCard({
    startPoint = "Campus 15",
    endPoint = "Campus 3",
    totalStops = 8,
    startTime = "07:30 AM"
}) {
    return (
        <Card className="bg-white border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800">Route Details</h3>
                <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">Active</span>
            </div>

            <div className="relative pl-4 space-y-6 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {/* Start Point */}
                <div className="relative">
                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white" />
                    <div>
                        <h4 className="font-bold text-sm text-slate-800">{startPoint}</h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                            <Clock size={12} /> Start: {startTime}
                        </p>
                    </div>
                </div>

                {/* End Point */}
                <div className="relative">
                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-slate-800 ring-4 ring-white" />
                    <div>
                        <h4 className="font-bold text-sm text-slate-800">{endPoint}</h4>
                        <p className="text-xs text-slate-500 mt-1">{totalStops} Intermediate Stops</p>
                    </div>
                </div>
            </div>
        </Card>
    );
}
