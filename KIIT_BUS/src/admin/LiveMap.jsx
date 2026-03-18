import { MapPin, Bus, Navigation } from "lucide-react";
import Card from "../components/ui/Card";

export default function LiveMap() {
  const vehicles = [
    { id: 1, number: 'UT-205', route: 'Hostel B → Campus 25', eta: '5 min', status: 'Running' },
    { id: 2, number: 'UT-312', route: 'Hostel K → Campus 25', eta: '12 min', status: 'Idle' },
  ]

  return (
    <div className="h-[calc(100vh-64px)] bg-slate-100 flex flex-col md:flex-row">
      {/* Sidebar/Overlay List */}
      <div className="w-full md:w-96 bg-white border-r border-slate-200 z-10 flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-xl font-bold text-secondary">Fleet Monitor</h1>
          <p className="text-slate-500 text-sm">Real-time GPS tracking</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {vehicles.map(v => (
            <Card key={v.id} className="!p-4 border border-slate-100 cursor-pointer hover:border-primary/50 transition-colors" hover>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold">
                    <Bus size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-secondary">{v.number}</h3>
                    <p className="text-xs text-slate-500">ETA: <span className="text-emerald-600 font-bold">{v.eta}</span></p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${v.status === 'Running' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                  {v.status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-white p-2 rounded border border-slate-100">
                <Navigation size={12} /> {v.route}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 bg-slate-200 relative flex items-center justify-center">
        <div className="text-center opacity-40">
          <MapPin size={64} className="mx-auto mb-4 text-slate-500" />
          <h2 className="text-2xl font-bold text-slate-600">Map Integration</h2>
          <p>Interactive map would render here</p>
        </div>

        {/* Overlay Gradient */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/5 to-transparent shadow-inner"></div>
      </div>
    </div>
  )
}
