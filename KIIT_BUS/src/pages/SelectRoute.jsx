import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bus, Clock, Search, MapPin, FlaskConical, Radio,
  AlertTriangle, CheckCircle2, ChevronRight, Zap,
  Navigation as NavIcon, Users, Timer, RefreshCw
} from "lucide-react";
import API_BASE from "../apiBase";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

// ─────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────
const ML_STORAGE_KEY = "kiit_ml_allocation";
const QUICK_TIMES = ["08:00","08:30","08:50","09:00","09:30","10:00","10:30","11:00","13:30","14:00","14:30","15:00"];

function toMin(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function toDisplay(min) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
function nowMin() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

// Which ML vehicle IDs are actively running at currentMin?
function getActiveMLIds(mlData, currentMin) {
  if (!mlData) return new Set();
  const p1 = mlData.phase1?.first_round_assignments ?? [];
  const p2 = mlData.phase2?.second_round_assignments ?? [];
  const active = new Set();
  for (const a of [...p1, ...p2]) {
    const s = toMin(a.start_time);
    const e = toMin(a.end_time ?? a.arrival_time);
    if (s !== null && e !== null && currentMin >= s && currentMin < e) {
      active.add(a.vehicle_id);
    }
  }
  return active;
}

// Positional map: ML BUS-01 → 1st DB bus sorted by bus_code
function buildDbToMlId(allDbBuses, mlData) {
  if (!mlData || !allDbBuses.length) return {};
  const p1 = mlData.phase1?.first_round_assignments ?? [];
  const p2 = mlData.phase2?.second_round_assignments ?? [];
  const allMlIds = [...new Set([...p1, ...p2].map(a => a.vehicle_id))].sort();
  const sorted   = [...allDbBuses].sort((a, b) => a.bus_code.localeCompare(b.bus_code));
  const dbToMl   = {};
  allMlIds.forEach((mlId, i) => {
    if (sorted[i]) dbToMl[sorted[i].bus_id] = mlId;
  });
  return dbToMl;
}

// Find what a given ML vehicle is doing at currentMin
function getAssignmentAt(mlData, mlVehicleId, currentMin) {
  if (!mlData || !mlVehicleId) return null;
  const p1 = mlData.phase1?.first_round_assignments ?? [];
  const p2 = mlData.phase2?.second_round_assignments ?? [];
  return [...p1, ...p2].find(a => {
    if (a.vehicle_id !== mlVehicleId) return false;
    const s = toMin(a.start_time);
    const e = toMin(a.end_time ?? a.arrival_time);
    return s !== null && e !== null && currentMin >= s && currentMin < e;
  }) ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// SelectBox
// ─────────────────────────────────────────────────────────────────────
function SelectBox({ value, onChange, options, placeholder, icon: Icon }) {
  return (
    <div className="relative">
      {Icon && <Icon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full py-4 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20
          focus:bg-white transition-all text-slate-800 font-medium appearance-none cursor-pointer
          ${Icon ? "pl-10 pr-10" : "px-4"}`}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <Search size={16} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// BusCard
// ─────────────────────────────────────────────────────────────────────
function BusCard({ bus, idx, testMode, isActive, assignment }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.06 }}
    >
      <Card className={`!p-4 border transition-all
        ${testMode
          ? isActive
            ? "border-emerald-200 bg-emerald-50/40 shadow-md hover:shadow-lg"
            : "border-slate-100 bg-slate-50/60 opacity-55"
          : "border shadow-sm hover:shadow-md hover:border-blue-200"}`}
      >
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center
              ${testMode
                ? isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                : "bg-slate-100 text-slate-600"}`}>
              <Bus size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800">{bus.bus_code}</h3>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {testMode ? (
                  isActive ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Running
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      Idle at this time
                    </span>
                  )
                ) : (
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Active Route</span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wide">Stops</p>
            <p className="text-xl font-bold text-emerald-600 flex items-center gap-1 justify-end">
              <Clock size={13} />{bus.route?.length || 0}
            </p>
          </div>
        </div>

        {/* ML assignment info in test mode */}
        {testMode && isActive && assignment && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-3">
            <Zap size={11} className="shrink-0" />
            <span>
              Serving <strong>{assignment.hostel ?? assignment.to_hostel}</strong>
              <span className="mx-1 text-emerald-400">·</span>
              {assignment.start_time}–{assignment.end_time ?? assignment.arrival_time}
              <span className="ml-1 text-emerald-500">(R{assignment.round ?? (assignment.to_hostel ? 2 : 1)})</span>
            </span>
          </div>
        )}

        <div className="text-sm text-slate-500 mb-3 flex items-center gap-1">
          <MapPin size={11} className="text-slate-400 shrink-0" />
          {bus.route?.[0]?.name}
          <ChevronRight size={11} className="text-slate-300" />
          {bus.route?.[bus.route.length - 1]?.name}
        </div>

        <Button variant="outline" className="w-full border-blue-200 text-blue-600 hover:bg-blue-50">
          Track Live Location
        </Button>
      </Card>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────
export default function SelectRoute() {
  const [pickup,      setPickup]      = useState("");
  const [destination, setDestination] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [stops,       setStops]       = useState([]);
  const [buses,       setBuses]       = useState([]);
  const [error,       setError]       = useState("");

  // Test mode state
  const [testMode,    setTestMode]    = useState(false);
  const [testMinutes, setTestMinutes] = useState(8 * 60 + 30);
  const [mlData,      setMlData]      = useState(null);
  const [allBusRoutes,setAllBusRoutes]= useState([]);

  const currentMin = testMode ? testMinutes : nowMin();

  // ── Waiting state ────────────────────────────────────────
  const WAITING_TTL = 20 * 60 * 1000;
  const [isWaiting,      setIsWaiting]      = useState(() => {
    const exp = localStorage.getItem('kiit_waiting_expiry');
    return exp ? Date.now() < Number(exp) : false;
  });
  const [waitingExpiry,  setWaitingExpiry]  = useState(() => {
    const exp = localStorage.getItem('kiit_waiting_expiry');
    return exp ? Number(exp) : null;
  });
  const [waitingSecsLeft, setWaitingSecsLeft] = useState(0);
  const [waitingLoading,  setWaitingLoading]  = useState(false);

  useEffect(() => {
    if (!isWaiting || !waitingExpiry) return;
    const tick = () => {
      const left = Math.max(0, Math.round((waitingExpiry - Date.now()) / 1000));
      setWaitingSecsLeft(left);
      if (left === 0) {
        setIsWaiting(false);
        setWaitingExpiry(null);
        localStorage.removeItem('kiit_waiting_expiry');
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isWaiting, waitingExpiry]);

  const handleMarkWaiting = async () => {
    if (isWaiting || waitingLoading) return;
    setWaitingLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/markWaiting`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const expiry = Date.now() + WAITING_TTL;
      localStorage.setItem('kiit_waiting_expiry', String(expiry));
      setWaitingExpiry(expiry);
      setIsWaiting(true);
    } catch (err) {
      console.error('markWaiting failed:', err.message);
    } finally {
      setWaitingLoading(false);
    }
  };

  const fmtCountdown = secs => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // Load stops + ML data + all bus routes
  useEffect(() => {
    fetch(`${API_BASE}/getStops`)
      .then(r => r.json()).then(d => setStops(Array.isArray(d) ? d : [])).catch(() => {});

    fetch(`${API_BASE}/getBusRoutes`, { credentials: "include" })
      .then(r => r.json()).then(d => setAllBusRoutes(Array.isArray(d) ? d : [])).catch(() => {});

    try {
      const s = sessionStorage.getItem(ML_STORAGE_KEY);
      if (s) setMlData(JSON.parse(s));
    } catch (_) {}
  }, []);

  // Re-search when test time changes (if already searched)
  useEffect(() => {
    if (showResults && testMode && pickup && destination) {
      doSearch(pickup, destination);
    }
  }, [testMinutes]); // eslint-disable-line

  const doSearch = useCallback(async (pickupId, destId) => {
    setLoading(true);
    setError("");
    try {
      // In test mode fetch ALL buses on route (no status filter), filter by ML time on frontend
      // In live mode fetch only active buses from backend
      const endpoint = testMode ? `${API_BASE}/getBusesForRoutesAll` : `${API_BASE}/getBusesForRoutes`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickupId: Number(pickupId), dropId: Number(destId) }),
      });
      const data = await res.json();
      setBuses(Array.isArray(data) ? data : []);
      setShowResults(true);
    } catch {
      setBuses([]);
      setShowResults(true);
    } finally {
      setLoading(false);
    }
  }, [testMode]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!pickup || !destination) { setError("Please select both pickup and destination."); return; }
    if (pickup === destination)  { setError("Pickup and destination cannot be same.");     return; }
    setError("");
    setShowResults(false);
    await doSearch(pickup, destination);
  };

  // Annotate buses with ML active status when in test mode
  const dbToMlId     = buildDbToMlId(allBusRoutes, mlData);
  const activeMLIds  = getActiveMLIds(mlData, currentMin);

  const annotatedBuses = buses.map(b => {
    if (!testMode) return { bus: b, isActive: true, assignment: null };
    const mlId      = dbToMlId[b.bus_id];
    const isActive  = mlId ? activeMLIds.has(mlId) : false;
    const assignment = getAssignmentAt(mlData, mlId, currentMin);
    return { bus: b, isActive, assignment };
  }).sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));

  const activeCount = annotatedBuses.filter(r => r.isActive).length;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-4rem)] pb-24 md:pb-12 bg-slate-50 relative">

      {/* HEADER BG */}
      <div className={`h-52 rounded-b-[40px] absolute top-0 inset-x-0 overflow-hidden transition-colors duration-300
        ${testMode ? "bg-amber-500" : "bg-blue-600"}`}>
        <div className="absolute top-[-50%] left-[-20%] w-[60%] h-[200%] bg-white/10 rounded-full blur-3xl rotate-12" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[150%] bg-white/5 rounded-full blur-3xl -rotate-12" />
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-8 relative z-10">

        {/* TITLE ROW */}
        <div className="text-white mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1 tracking-tight">Find your ride</h1>
            <p className="opacity-80 text-sm">
              {testMode
                ? `Simulating availability at ${toDisplay(testMinutes)}`
                : "Where are you going today?"}
            </p>
          </div>

          {/* Test mode toggle */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              onClick={() => { setTestMode(t => !t); setShowResults(false); }}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all
                ${testMode
                  ? "bg-white text-amber-600 border-white/50 shadow-md"
                  : "bg-white/15 text-white border-white/20 hover:bg-white/25"}`}>
              <FlaskConical size={13} />
              {testMode ? "Exit Test" : "Test Mode"}
            </button>
            <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border
              ${testMode ? "bg-amber-400/30 border-amber-200/50 text-amber-100" : "bg-white/10 border-white/20 text-white/80"}`}>
              {testMode
                ? <><FlaskConical size={9} /> {toDisplay(testMinutes)}</>
                : <><Radio size={9} className="animate-pulse text-emerald-300" /> Live · {toDisplay(currentMin)}</>}
            </div>
          </div>
        </div>

        {/* TEST MODE TIME PANEL */}
        <AnimatePresence>
          {testMode && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white rounded-2xl border border-amber-200 shadow-lg px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <FlaskConical size={14} className="text-amber-500" />
                  <span className="text-sm font-bold text-amber-700">Simulated Time</span>
                  <span className="font-mono text-sm font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg ml-1">
                    {toDisplay(testMinutes)}
                  </span>
                  {!mlData && (
                    <span className="ml-auto text-[10px] text-amber-500 flex items-center gap-1">
                      <AlertTriangle size={10} /> No ML data — run simulation in Admin first
                    </span>
                  )}
                  {mlData && (
                    <span className="ml-auto text-[10px] text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={10} /> ML data loaded
                    </span>
                  )}
                </div>

                <input
                  type="range" min={0} max={23 * 60 + 59} step={1} value={testMinutes}
                  onChange={e => setTestMinutes(Number(e.target.value))}
                  className="w-full accent-amber-500 mb-2"
                />
                <div className="flex justify-between text-[10px] text-amber-400 font-mono mb-3">
                  {["00:00","06:00","09:00","12:00","15:00","18:00","23:59"].map(t => <span key={t}>{t}</span>)}
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  <span className="text-xs text-amber-600 font-semibold mr-1 self-center">Jump:</span>
                  {QUICK_TIMES.map(t => (
                    <button key={t} onClick={() => setTestMinutes(toMin(t))}
                      className={`text-xs font-mono px-2.5 py-1 rounded-lg border transition-colors
                        ${testMinutes === toMin(t)
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SEARCH CARD */}
        <Card className="mb-6 !p-6 shadow-xl border-0">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative pl-8 space-y-4">
              {/* Vertical connector */}
              <div className="absolute left-3 top-3 bottom-10 w-0.5 bg-slate-200">
                <div className="absolute -top-1 -left-[5px] w-3 h-3 rounded-full border-2 border-slate-300 bg-white" />
                <div className={`absolute -bottom-1 -left-[5px] w-3 h-3 rounded-full ring-4
                  ${testMode ? "bg-amber-500 ring-amber-500/20" : "bg-blue-600 ring-blue-500/20"}`} />
              </div>
              <SelectBox value={pickup}      onChange={setPickup}      options={stops} placeholder="Pickup Location" icon={MapPin} />
              <SelectBox value={destination} onChange={setDestination} options={stops} placeholder="Destination"     icon={NavIcon} />
            </div>

            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1.5 bg-red-50 px-3 py-2 rounded-xl border border-red-100">
                <AlertTriangle size={13} /> {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              className={`w-full py-4 text-lg font-bold shadow-lg mt-4 transition-colors
                ${testMode ? "!bg-amber-500 hover:!bg-amber-600 shadow-amber-200" : "shadow-blue-500/30"}`}
              isLoading={loading}
            >
              {testMode ? `Search at ${toDisplay(testMinutes)}` : "Search Buses"}
            </Button>
          </form>
        </Card>

        {/* MARK AS WAITING BANNER */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`mb-5 rounded-2xl border p-4 flex items-center gap-4 transition-all duration-500
            ${isWaiting
              ? 'bg-emerald-50 border-emerald-200 shadow-sm'
              : 'bg-white border-slate-200 shadow-sm'}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors
            ${isWaiting ? 'bg-emerald-100 text-emerald-600' : 'bg-purple-50 text-purple-600'}`}>
            {isWaiting ? <Timer size={18} /> : <Users size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            {isWaiting ? (
              <>
                <p className="font-bold text-emerald-700 text-sm">You're marked as waiting</p>
                <p className="text-xs text-emerald-500 mt-0.5 flex items-center gap-1">
                  <Timer size={10} />
                  Expires in <span className="font-mono font-bold ml-1">{fmtCountdown(waitingSecsLeft)}</span>
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-slate-800 text-sm">Waiting for a bus?</p>
                <p className="text-xs text-slate-400 mt-0.5">Alert the admin — auto-clears in 20 min.</p>
              </>
            )}
          </div>
          <button
            onClick={!isWaiting && !waitingLoading ? handleMarkWaiting : undefined}
            disabled={isWaiting || waitingLoading}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all select-none
              ${isWaiting
                ? 'bg-emerald-100 text-emerald-500 cursor-not-allowed pointer-events-none'
                : waitingLoading
                  ? 'bg-purple-100 text-purple-400 cursor-wait pointer-events-none'
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-200 active:scale-95 cursor-pointer'}`}
          >
            {waitingLoading
              ? <><RefreshCw size={13} className="animate-spin" /> Marking…</>
              : isWaiting
                ? <><CheckCircle2 size={13} /> Marked! ({fmtCountdown(waitingSecsLeft)})</>
                : <><Users size={13} /> Mark As Waiting</>}
          </button>
        </motion.div>

        {/* RESULTS */}
        <AnimatePresence>
          {showResults && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

              <div className="flex items-center gap-2 px-1">
                <h2 className="text-lg font-bold text-slate-800">
                  {testMode ? "Buses on this route" : "Available Buses"}
                  <span className="text-slate-400 text-sm font-normal ml-1.5">({buses.length})</span>
                </h2>
                {testMode && buses.length > 0 && (
                  <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full
                    ${activeCount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {activeCount} running at {toDisplay(testMinutes)}
                  </span>
                )}
              </div>

              {/* No ML data warning in test mode */}
              {testMode && !mlData && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                  <AlertTriangle size={13} className="shrink-0" />
                  ML allocation not loaded — all buses shown as idle. Run the simulation in the Admin panel first.
                </div>
              )}

              {buses.length > 0 ? (
                annotatedBuses.map(({ bus, isActive, assignment }, idx) => (
                  <BusCard
                    key={bus.bus_id}
                    bus={bus}
                    idx={idx}
                    testMode={testMode}
                    isActive={isActive}
                    assignment={assignment}
                  />
                ))
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <Bus size={28} />
                  </div>
                  <p className="text-slate-500 font-medium">
                    {testMode ? "No buses cover this route." : "No active buses found for this route."}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}