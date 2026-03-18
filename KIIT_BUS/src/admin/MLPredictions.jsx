import { useState, useEffect, useRef } from "react";
import {
  Brain, Upload, Play, Loader2, FileText, AlertCircle,
  Download, CheckCircle2, BarChart3, Zap, TrendingDown,
  Bus, Users, Target, ChevronRight
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import API_BASE_ROOT from "../apiBase";

const ML_STORAGE_KEY = "kiit_ml_allocation";
const API_BASE = API_BASE_ROOT;
// ─── Helpers ─────────────────────────────────────────────────
function ServePctBar({ pct, isOptimal }) {
  const color = pct>=100 ? "bg-emerald-500" : pct>=75 ? "bg-blue-500" : pct>=50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full transition-all duration-500 ${color} ${isOptimal ? "ring-2 ring-emerald-400 ring-offset-1" : ""}`}
          style={{width:`${Math.min(pct,100)}%`}}/>
      </div>
      <span className={`text-xs font-bold w-10 text-right ${pct>=100 ? "text-emerald-600" : "text-slate-600"}`}>{pct}%</span>
    </div>
  );
}

function TrendBadge({ trend }) {
  if (!trend) return <span className="text-slate-300 text-xs">—</span>;
  const map = {
    improving: <span className="text-xs text-emerald-600 font-semibold">↓ better</span>,
    saturated: <span className="text-xs text-slate-400 font-semibold">→ same</span>,
  };
  return map[trend] ?? <span className="text-xs text-red-500 font-semibold">↑ worse</span>;
}

// ─── Main component ──────────────────────────────────────────
export default function MLPredictions() {
  const [file,           setFile]           = useState(null);
  const [buses,          setBuses]          = useState(5);
  const [shuttles,       setShuttles]       = useState(2);
  const [loading,        setLoading]        = useState(false);
  const [phase1Data,     setPhase1Data]     = useState(null);
  const [phase2Data,     setPhase2Data]     = useState(null);
  const [busTimetable,   setBusTimetable]   = useState(null);
  const [error,          setError]          = useState(null);
  const [savedAt,        setSavedAt]        = useState(null);
  const [analysisLoading,setAnalysisLoading]= useState(false);
  const [analysisData,   setAnalysisData]   = useState(null);
  const [analysisError,  setAnalysisError]  = useState(null);
  const analysisRef = useRef(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(ML_STORAGE_KEY);
      if (stored) {
        const { phase1, phase2, timetable, savedAt: ts } = JSON.parse(stored);
        setPhase1Data(phase1); setPhase2Data(phase2);
        setBusTimetable(timetable); setSavedAt(ts);
      }
    } catch (_) {}
  }, []);

  const handleFileChange = e => {
    if (e.target.files?.[0]) { setFile(e.target.files[0]); setError(null); setAnalysisError(null); }
  };

  const runSimulation = async () => {
    if (!file) { setError("Upload a CSV file first"); return; }
    setLoading(true); setError(null);
    const formData = new FormData();
    formData.append("file", file); formData.append("buses", buses); formData.append("shuttles", shuttles);
    try {
      const res = await fetch(`${API_BASE}/ml/run-all`, { method:"POST", body:formData });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (!data.result) throw new Error("Invalid response format");

      const { phase1, phase2 } = data.result;
      setPhase1Data(phase1); setPhase2Data(phase2);

      const timetable = [
        ...(phase1.first_round_assignments?.flatMap(item => [
          { vehicle_id:item.vehicle_id, time:item.start_time, hostel:item.hostel, predicted:item.predicted_students },
          { vehicle_id:item.vehicle_id, time:item.end_time,   hostel:item.hostel, predicted:"N/A" },
        ]) ?? []),
        ...(phase2.second_round_assignments?.flatMap(item => [
          { vehicle_id:item.vehicle_id, time:item.start_time,   hostel:item.to_hostel, predicted:"N/A" },
          { vehicle_id:item.vehicle_id, time:item.arrival_time, hostel:item.to_hostel, predicted:"N/A" },
        ]) ?? []),
      ].sort((a,b)=>a.vehicle_id===b.vehicle_id ? a.time.localeCompare(b.time) : a.vehicle_id.localeCompare(b.vehicle_id));

      setBusTimetable(timetable);
      const ts = new Date().toISOString();
      setSavedAt(ts);
      sessionStorage.setItem(ML_STORAGE_KEY, JSON.stringify({ phase1, phase2, timetable, savedAt:ts }));
    } catch (err) {
      setError(err.message || "Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  const runFleetAnalysis = async () => {
    if (!file) { setAnalysisError("Upload a CSV file first"); return; }
    setAnalysisLoading(true); setAnalysisError(null); setAnalysisData(null);
    const formData = new FormData();
    formData.append("file", file); formData.append("shuttles", shuttles);
    try {
      const res = await fetch(`${API_BASE}/ml/fleet-analysis`, { method:"POST", body:formData });
      if (!res.ok) throw new Error(await res.text());
      setAnalysisData(await res.json());
      setTimeout(()=>analysisRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
    } catch (err) {
      setAnalysisError(err.message || "Fleet analysis failed");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const exportCSV = () => {
    if (!busTimetable) return;
    const header = ["Vehicle ID","Hostel","Time","Predicted Demand"];
    const rows   = busTimetable.map(r=>[r.vehicle_id,r.hostel,r.time,r.predicted]);
    const csv    = [header,...rows].map(e=>e.join(",")).join("\n");
    const url    = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    Object.assign(document.createElement("a"),{href:url,download:"vehicle_timetable.csv"}).click();
  };

  const simSummary = (() => {
    if (!phase2Data) return null;
    const s = phase2Data.hostel_second_round_summary ?? [];
    const totalPredicted = s.reduce((a,x)=>a+x.predicted_students,0);
    const totalServed    = s.reduce((a,x)=>a+x.total_served,0);
    const remaining      = s.reduce((a,x)=>a+x.remaining_students,0);
    return { totalPredicted, totalServed, remaining, pct:Math.round(totalServed/Math.max(totalPredicted,1)*100) };
  })();

  const groupedTimetable = busTimetable
    ? busTimetable.reduce((acc,item)=>{ (acc[item.vehicle_id]=acc[item.vehicle_id]||[]).push(item); return acc; }, {})
    : {};

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
              <Brain className="text-white" size={28}/>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-secondary">AI Transport Allocation</h1>
              <p className="text-slate-500 text-sm">Upload demand data to optimize fleet allocation</p>
            </div>
          </div>
          {savedAt && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">
              <CheckCircle2 size={15}/>
              Results saved — Hostels &amp; Vehicles updated.{" "}
              <span className="text-emerald-400 text-xs">{new Date(savedAt).toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        {/* Input card */}
        <Card className="p-6 md:p-8">
          <div className="grid md:grid-cols-3 gap-8">
            {/* File upload */}
            <div>
              <label className="block font-bold mb-3 text-sm text-slate-700">1. Upload Data (CSV)</label>
              <div className="relative cursor-pointer">
                <input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-10"/>
                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors
                  ${file ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"}`}>
                  {file ? (
                    <><FileText className="mx-auto mb-2 text-emerald-600" size={22}/>
                      <p className="font-semibold text-emerald-700 text-sm truncate">{file.name}</p>
                      <p className="text-xs text-emerald-500 mt-1">Ready to run</p></>
                  ) : (
                    <><Upload className="mx-auto mb-2 text-slate-400" size={22}/>
                      <p className="text-slate-500 text-sm">Click to upload CSV</p></>
                  )}
                </div>
              </div>
            </div>

            {/* Fleet config */}
            <div>
              <label className="block font-bold mb-3 text-sm text-slate-700">2. Fleet Configuration</label>
              <div className="space-y-4">
                {[
                  { label:"Buses", hint:"capacity 60 each", value:buses, min:1, onChange:v=>setBuses(v) },
                  { label:"Shuttles", hint:"capacity 20 each", value:shuttles, min:0, onChange:v=>setShuttles(v) },
                ].map(({ label, hint, value, min, onChange }) => (
                  <div key={label}>
                    <p className="text-xs text-slate-400 mb-1">{label} <span className="text-indigo-400">({hint})</span></p>
                    <input type="number" min={min} value={value}
                      onChange={e=>onChange(Number(e.target.value))}
                      className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"/>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col justify-end gap-3">
              <button onClick={runSimulation} disabled={loading}
                className="h-14 text-base font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md shadow-indigo-200">
                {loading ? <Loader2 className="animate-spin" size={18}/> : <Play size={18}/>}
                Run Simulation
              </button>
              <button onClick={runFleetAnalysis} disabled={analysisLoading}
                className="h-12 text-sm font-semibold bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white rounded-xl flex items-center justify-center gap-2 transition-colors">
                {analysisLoading ? <Loader2 className="animate-spin" size={15}/> : <BarChart3 size={15}/>}
                Analyze Fleet Size
              </button>
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-sm border border-red-100">
                  <AlertCircle size={15}/> {error}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Sim summary */}
        {simSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label:"Total Predicted", value:simSummary.totalPredicted, icon:Users,       color:"text-indigo-600", bg:"bg-indigo-50" },
              { label:"Total Served",    value:simSummary.totalServed,    icon:CheckCircle2, color:"text-emerald-600", bg:"bg-emerald-50" },
              { label:"Still Waiting",   value:simSummary.remaining,      icon:AlertCircle,  color:"text-amber-600",  bg:"bg-amber-50" },
              { label:"Serve Rate",      value:`${simSummary.pct}%`,      icon:Target,       color:"text-blue-600",   bg:"bg-blue-50" },
            ].map(({ label, value, icon:Icon, color, bg }) => (
              <Card key={label} className={`p-4 flex items-center gap-3 ${bg} border-0`}>
                <div className="p-2 rounded-lg bg-white shadow-sm shrink-0"><Icon size={18} className={color}/></div>
                <div>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{typeof value==="number" ? value.toLocaleString() : value}</p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Fleet analysis error */}
        {analysisError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center gap-2">
            <AlertCircle size={17}/> {analysisError}
          </div>
        )}

        {/* Fleet analysis loading */}
        {analysisLoading && (
          <Card className="p-10 flex flex-col items-center gap-4 text-slate-500">
            <Loader2 className="animate-spin text-indigo-500" size={32}/>
            <p className="font-semibold">Running fleet analysis across all bus counts…</p>
            <p className="text-sm text-slate-400">This may take a few seconds</p>
          </Card>
        )}

        {/* Fleet analysis results */}
        {analysisData && !analysisLoading && (
          <Card className="p-6 md:p-8" ref={analysisRef}>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-xl"><BarChart3 className="text-white" size={20}/></div>
                <div>
                  <h2 className="text-xl font-bold text-secondary">Fleet Size Analysis</h2>
                  <p className="text-sm text-slate-500">
                    Total demand: <span className="font-semibold text-slate-700">{analysisData.total_demand.toLocaleString()} students</span>
                    {" · "}{shuttles} shuttle{shuttles!==1?"s":""} fixed
                  </p>
                </div>
              </div>
              {analysisData.min_buses_for_full_coverage && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">
                  <Zap size={15} className="text-emerald-600"/>
                  <span className="text-sm font-semibold text-emerald-700">
                    Min for 100%: <span className="text-emerald-900">{analysisData.min_buses_for_full_coverage} buses</span>
                  </span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    {["Buses","Served (P1)","+Phase 2","Total Served","Remaining","Serve Rate","Trend"].map(h=>(
                      <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analysisData.results.map((row,i) => (
                    <tr key={i} className={`border-b transition-colors ${row.is_optimal ? "bg-emerald-50 border-emerald-200" : i%2===0 ? "bg-white" : "bg-slate-50"} hover:bg-indigo-50`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Bus size={14} className={row.is_optimal ? "text-emerald-600" : "text-slate-400"}/>
                          <span className={`font-bold ${row.is_optimal ? "text-emerald-700" : "text-slate-700"}`}>{row.buses}</span>
                          {row.is_optimal && <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full font-semibold">optimal</span>}
                          {row.buses===buses && !row.is_optimal && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">current</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.p1_served.toLocaleString()}</td>
                      <td className="px-4 py-3"><span className="text-blue-600 font-medium">+{row.p2_contribution.toLocaleString()}</span></td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.total_served.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={row.remaining===0 ? "text-emerald-600 font-bold" : "text-red-500 font-medium"}>
                          {row.remaining===0 ? "✓ 0" : row.remaining.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 w-44"><ServePctBar pct={row.serve_pct} isOptimal={row.is_optimal}/></td>
                      <td className="px-4 py-3"><TrendBadge trend={row.trend}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Insight cards */}
            <div className="mt-5 grid md:grid-cols-3 gap-4">
              {[
                { icon:TrendingDown, color:"text-blue-600",    bg:"bg-blue-50",    title:"Phase 2 Contribution",
                  body:"The '+Phase 2' column shows extra students served when vehicles are reused after their first trip." },
                { icon:Zap,          color:"text-emerald-600", bg:"bg-emerald-50", title:"Optimal Fleet",
                  body:analysisData.min_buses_for_full_coverage
                    ? `You need ${analysisData.min_buses_for_full_coverage} buses (with ${shuttles} shuttles) to fully serve all ${analysisData.total_demand.toLocaleString()} students.`
                    : "Increase bus count or shuttles to find full coverage." },
                { icon:ChevronRight,  color:"text-indigo-600", bg:"bg-indigo-50",  title:"Next Step",
                  body:"Set your bus count above and click 'Run Simulation' to generate the full timetable and hostel breakdown." },
              ].map(({ icon:Icon, color, bg, title, body }) => (
                <div key={title} className={`${bg} rounded-xl p-4 flex gap-3`}>
                  <Icon size={17} className={`${color} mt-0.5 shrink-0`}/>
                  <div>
                    <p className={`text-xs font-bold ${color} mb-1`}>{title}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Vehicle timetable */}
        {busTimetable && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
              <h2 className="text-xl font-bold text-secondary flex items-center gap-2">
                <Bus size={20} className="text-indigo-600"/> Vehicle Timetable
              </h2>
              <button onClick={exportCSV}
                className="flex items-center gap-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg transition-colors">
                <Download size={14}/> Export CSV
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
                    {["Vehicle","Time","Hostel","Predicted Demand"].map(h=>(
                      <th key={h} className="p-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedTimetable).map(([vehicleId,trips])=>
                    trips.map((trip,idx)=>(
                      <tr key={`${vehicleId}-${idx}`} className="border-b hover:bg-slate-50">
                        <td className="p-3 font-bold text-indigo-700">{idx===0 ? vehicleId : ""}</td>
                        <td className="p-3 font-mono text-slate-600">{trip.time}</td>
                        <td className="p-3 text-slate-700">{trip.hostel}</td>
                        <td className="p-3 text-slate-400">{trip.predicted}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}