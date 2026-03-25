import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bus, Clock, Wrench, Users, Map as MapIcon, BrainCircuit, TrendingUp, Activity } from "lucide-react";
import StatCard from "../components/StatCard";
import API_BASE from "../apiBase";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

export default function AdminDashboard() {
  const [busStats, setBusStats] = useState({ active_buses: 0, idle_buses: 0, maintenance_buses: 0 });
  const [waitingCount, setWaitingCount] = useState(0);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const fetchBusStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/getTotalActiveIdleMaintenanceBuses`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        setBusStats(await res.json());
      } catch (err) {
        console.error("Failed to fetch bus stats:", err.message);
      }
    };

    const fetchWaitingCount = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/getWaitingCount`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setWaitingCount(data.count);
      } catch (err) {
        console.error("Failed to fetch waiting count:", err.message);
      }
    };

    fetchBusStats();
    fetchWaitingCount();
    const clockTick = setInterval(() => setTime(new Date()), 60_000);
    // Poll waiting count every 30 s so the admin sees near-real-time updates
    const waitingPoll = setInterval(fetchWaitingCount, 10_000);
    return () => { clearInterval(clockTick); clearInterval(waitingPoll); };
  }, []);

  const stats = [
    { title: "Active Buses",    value: busStats.active_buses,      badge: "LIVE",  icon: Bus,    color: "green"  },
    { title: "Idle Buses",      value: busStats.idle_buses,                         icon: Clock,  color: "orange" },
    { title: "Maintenance",     value: busStats.maintenance_buses,  badge: "ALERT", icon: Wrench, color: "red"    },
    { title: "Students Waiting",value: waitingCount,                badge: "NOW",   icon: Users,  color: "blue"   },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
            {time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-3xl font-bold text-secondary">Dashboard Overview</h1>
          <p className="text-slate-500 mt-1">Real-time fleet monitoring and management</p>
        </div>
        <div className="flex gap-3">
          <Button size="sm" variant="outline">Export Data</Button>
          <Button size="sm" variant="primary" icon={Bus}>Add Vehicle</Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((s, i) => (
          <StatCard key={i} {...s} />
        ))}
      </div>

      {/* Fleet health bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <Activity size={16} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-600">Fleet Health</span>
        </div>
        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden flex">
          {(() => {
            const total = busStats.active_buses + busStats.idle_buses + busStats.maintenance_buses || 1;
            return (
              <>
                <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${(busStats.active_buses / total) * 100}%` }} />
                <div className="h-full bg-amber-400 transition-all duration-700" style={{ width: `${(busStats.idle_buses / total) * 100}%` }} />
                <div className="h-full bg-red-400 transition-all duration-700"   style={{ width: `${(busStats.maintenance_buses / total) * 100}%` }} />
              </>
            );
          })()}
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Active</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />Idle</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" />Maintenance</span>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Map Card */}
        <Card className="relative overflow-hidden group bg-gradient-to-br from-blue-600 to-indigo-700 border-0 shadow-lg shadow-indigo-200/50 !text-white">
          <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <MapIcon size={140} />
          </div>
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" /> LIVE
            </span>
            <h3 className="text-2xl font-bold mb-2">Live Vehicle Tracking</h3>
            <p className="text-blue-100 text-sm mb-6 max-w-sm">Monitor real-time GPS locations of all shuttles and buses across the campus.</p>
            <Link to="/admin/live-map">
              <button className="flex items-center gap-2 bg-white text-blue-700 font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-colors shadow-md">
                <MapIcon size={16} /> Open Live Map
              </button>
            </Link>
          </div>
        </Card>

        {/* AI Card */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-violet-600 to-purple-700 border-0 shadow-lg shadow-purple-200/50 !text-white">
          <div className="absolute -right-8 -bottom-8 opacity-10">
            <BrainCircuit size={140} />
          </div>
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full mb-4">
              <TrendingUp size={10} /> AI BETA
            </span>
            <h3 className="text-2xl font-bold mb-3">AI Optimization</h3>
            <div className="bg-white/15 backdrop-blur rounded-xl p-4 border border-white/20 mb-6">
              <p className="text-[11px] font-bold text-purple-200 uppercase tracking-wide mb-1">Latest Recommendation</p>
              <p className="text-sm text-white/90">
                Allocate <span className="font-bold text-white">Bus #12</span> to Hostel K from{" "}
                <span className="font-bold text-white">6:30–7:00 PM</span> to prevent overcrowding.
              </p>
            </div>
            <Link to="/admin/ml">
              <button className="flex items-center gap-2 bg-white text-purple-700 font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-purple-50 transition-colors shadow-md">
                <BrainCircuit size={16} /> View Predictions
              </button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}