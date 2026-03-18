import { BarChart3, TrendingUp, Clock, Users, ArrowUpRight } from "lucide-react";
import Card from "../components/ui/Card";

const METRICS = [
  { title: "Daily Usage",    value: "1,248",        unit: "rides",   icon: Users,    color: "text-blue-600",    bg: "bg-blue-50",    trend: "+12% vs yesterday" },
  { title: "Peak Hour",      value: "8:00–9:00",    unit: "AM",      icon: Clock,    color: "text-orange-600",  bg: "bg-orange-50",  trend: "Consistent this week" },
  { title: "Avg Wait Time",  value: "6",            unit: "mins",    icon: TrendingUp,color:"text-emerald-600", bg: "bg-emerald-50", trend: "↓ 1 min vs last week" },
  { title: "Utilization",    value: "82",           unit: "%",       icon: BarChart3, color: "text-purple-600",  bg: "bg-purple-50",  trend: "Near capacity" },
];

export default function Reports() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-secondary">Analytics Report</h1>
            <p className="text-slate-500 mt-1">Performance metrics and usage statistics</p>
          </div>
          <div className="flex gap-2">
            {["Today", "7D", "30D"].map((r, i) => (
              <button
                key={r}
                className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors
                  ${i === 0 ? "bg-secondary text-white border-secondary shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {METRICS.map((m, i) => (
            <Card key={i} className="!p-6 border-0 shadow-md shadow-slate-200/50 hover:shadow-lg transition-shadow" hover delay={i * 0.08}>
              <div className="flex items-start justify-between mb-5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${m.bg} ${m.color}`}>
                  <m.icon size={22} />
                </div>
                <ArrowUpRight size={16} className="text-slate-300" />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{m.title}</p>
              <div className="flex items-baseline gap-1 mb-2">
                <h3 className="text-3xl font-black text-secondary">{m.value}</h3>
                <span className="text-sm text-slate-400 font-medium">{m.unit}</span>
              </div>
              <p className="text-xs text-slate-400">{m.trend}</p>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="border-0 shadow-md shadow-slate-200/50 !p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-secondary text-base">Usage Trends</h2>
              <span className="text-xs text-slate-400 font-medium">Last 7 days</span>
            </div>
            <div className="h-64 flex items-center justify-center">
              {/* Placeholder bars */}
              <div className="flex items-end gap-3 h-40">
                {[60, 85, 70, 90, 55, 78, 82].map((h, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div
                      className="w-8 rounded-t-lg bg-gradient-to-t from-blue-500 to-blue-400 opacity-80"
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-[10px] text-slate-400">
                      {["M","T","W","T","F","S","S"][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="border-0 shadow-md shadow-slate-200/50 !p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-secondary text-base">Route Efficiency</h2>
              <span className="text-xs text-slate-400 font-medium">By route</span>
            </div>
            <div className="h-64 p-6 flex flex-col justify-center gap-4">
              {[
                { label: "Route 1 — I Love KIIT", pct: 88, color: "bg-blue-500" },
                { label: "Route 2 — East Campus",  pct: 74, color: "bg-indigo-500" },
                { label: "Route 3 — West Circle",  pct: 65, color: "bg-violet-500" },
              ].map(r => (
                <div key={r.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">{r.label}</span>
                    <span className="text-slate-400 font-bold">{r.pct}%</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${r.color} rounded-full transition-all duration-700`} style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Summary footer */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-4 flex flex-wrap gap-6">
          {[
            { label: "Total Rides (Month)", value: "36,240" },
            { label: "Avg Buses/Day",       value: "12" },
            { label: "Complaints Filed",    value: "3" },
            { label: "On-time Rate",        value: "91%" },
          ].map(s => (
            <div key={s.label}>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{s.label}</p>
              <p className="text-xl font-black text-secondary mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}