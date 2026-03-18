import { useEffect, useState, useCallback, useRef } from "react";
import {
  Bus, Truck, MapPin, BrainCircuit, RefreshCw, CheckCircle2,
  Clock, ArrowRight, Radio, FlaskConical, Zap, WifiOff,
  AlertTriangle, ChevronRight, Activity, Gauge, Info
} from "lucide-react";
import AdminNavbar from "../components/AdminNavbar";
import API_BASE from "../apiBase";

// ─────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────
const ML_STORAGE_KEY = "kiit_ml_allocation";

// ─────────────────────────────────────────────────────────────────────
// Time helpers
// ─────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────
// ML data helpers
// ─────────────────────────────────────────────────────────────────────
function flattenAssignments(mlData) {
  if (!mlData) return [];
  const p1 = (mlData.phase1?.first_round_assignments ?? []).map(a => ({
    ml_vehicle_id: a.vehicle_id,
    vehicle_type:  a.vehicle_type,
    hostel:        a.hostel,
    time_slot:     a.time_slot,
    start_time:    a.start_time,
    end_time:      a.end_time,
    students:      a.students_assigned,
    round:         1,
  }));
  const p2 = (mlData.phase2?.second_round_assignments ?? []).map(a => ({
    ml_vehicle_id: a.vehicle_id,
    vehicle_type:  a.vehicle_type,
    hostel:        a.to_hostel,
    time_slot:     a.time_slot,
    start_time:    a.start_time,
    end_time:      a.arrival_time,
    students:      a.students_assigned,
    round:         2,
  }));
  return [...p1, ...p2];
}

// ML synthetic IDs are positional: BUS-01 = 1st DB bus sorted by code, etc.
function buildMlToDbMap(dbBuses, mlData) {
  if (!mlData || !dbBuses.length) return {};
  const allAsgn      = flattenAssignments(mlData);
  const mlBusIds     = [...new Set(allAsgn.filter(a => a.vehicle_type === "Bus")    .map(a => a.ml_vehicle_id))].sort();
  const mlShuttleIds = [...new Set(allAsgn.filter(a => a.vehicle_type === "Shuttle").map(a => a.ml_vehicle_id))].sort();
  const dbBuses_     = dbBuses.filter(b => (b.vehicle_type ?? "Bus") !== "Shuttle").sort((a, b) => a.bus_code.localeCompare(b.bus_code));
  const dbShuttles_  = dbBuses.filter(b =>  b.vehicle_type            === "Shuttle").sort((a, b) => a.bus_code.localeCompare(b.bus_code));
  const map = {};
  mlBusIds    .forEach((mlId, i) => { if (dbBuses_[i])    map[mlId] = { bus_id: dbBuses_[i].bus_id,    bus_code: dbBuses_[i].bus_code };    });
  mlShuttleIds.forEach((mlId, i) => { if (dbShuttles_[i]) map[mlId] = { bus_id: dbShuttles_[i].bus_id, bus_code: dbShuttles_[i].bus_code }; });
  return map;
}

function countMlAllocated(mlData) {
  if (!mlData) return { buses: 0, shuttles: 0 };
  const allAsgn  = flattenAssignments(mlData);
  const buses    = new Set(allAsgn.filter(a => a.vehicle_type === "Bus")    .map(a => a.ml_vehicle_id)).size;
  const shuttles = new Set(allAsgn.filter(a => a.vehicle_type === "Shuttle").map(a => a.ml_vehicle_id)).size;
  return { buses, shuttles };
}

function resolveAssignmentForDb(assignments, mlVehicleId, currentMin) {
  if (!mlVehicleId) return null;
  const mine = assignments.filter(a => a.ml_vehicle_id === mlVehicleId);
  if (!mine.length) return null;
  const active = mine.find(a => {
    const s = toMin(a.start_time), e = toMin(a.end_time);
    return s !== null && e !== null && currentMin >= s && currentMin < e;
  });
  if (active) return { ...active, status: "active" };
  const upcoming = mine.filter(a => toMin(a.start_time) > currentMin)
    .sort((a, b) => toMin(a.start_time) - toMin(b.start_time))[0];
  if (upcoming) return { ...upcoming, status: "upcoming" };
  const past = mine.filter(a => toMin(a.start_time) <= currentMin)
    .sort((a, b) => toMin(b.start_time) - toMin(a.start_time))[0];
  if (past) return { ...past, status: "done" };
  return null;
}

function allTripsForMlId(assignments, mlVehicleId) {
  return assignments
    .filter(a => a.ml_vehicle_id === mlVehicleId)
    .sort((a, b) => toMin(a.start_time) - toMin(b.start_time));
}

// ─────────────────────────────────────────────────────────────────────
// Small UI components
// ─────────────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const cfg = {
    active:      { label: "Running",     dot: "bg-emerald-400 animate-pulse", text: "text-emerald-700", ring: "bg-emerald-50 border-emerald-200" },
    idle:        { label: "Idle",         dot: "bg-amber-400",                text: "text-amber-700",   ring: "bg-amber-50 border-amber-200" },
    maintenance: { label: "Maintenance", dot: "bg-red-400",                  text: "text-red-700",     ring: "bg-red-50 border-red-200" },
  }[status] ?? { label: status, dot: "bg-slate-300", text: "text-slate-500", ring: "bg-slate-50 border-slate-200" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${cfg.ring} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function AssignBadge({ status }) {
  if (!status) return null;
  const cfg = {
    active:   { label: "Active now", cls: "bg-emerald-50 border-emerald-300 text-emerald-700" },
    upcoming: { label: "Upcoming",   cls: "bg-blue-50 border-blue-300 text-blue-700" },
    done:     { label: "Completed",  cls: "bg-slate-50 border-slate-300 text-slate-500" },
  }[status];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${cfg.cls}`}>
      {status === "active"   && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
      {status === "upcoming" && <Clock size={9} />}
      {status === "done"     && <CheckCircle2 size={9} />}
      {cfg.label}
    </span>
  );
}

function TripTimeline({ trips, currentMin }) {
  if (!trips || !trips.length) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap mt-2">
      {trips.map((t, i) => {
        const s = toMin(t.start_time), e = toMin(t.end_time);
        const isNow  = s !== null && e !== null && currentMin >= s && currentMin < e;
        const isPast = e !== null && currentMin >= e;
        return (
          <div key={i} className="flex items-center gap-1">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono border
              ${isNow  ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-bold ring-1 ring-emerald-300" :
                isPast ? "bg-slate-50 border-slate-200 text-slate-400" :
                         "bg-blue-50 border-blue-200 text-blue-600"}`}>
              <span className={isPast ? "line-through opacity-60" : ""}>{t.hostel}</span>
              <span className="opacity-50 ml-1">{t.start_time}</span>
            </div>
            {i < trips.length - 1 && <ChevronRight size={9} className="text-slate-300 shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// VehicleCard
// ─────────────────────────────────────────────────────────────────────
function VehicleCard({
  bus, mlVehicleId, isAllocated, stops, allAssignments,
  currentMin, campus25Stop, findStopByName,
  onStatusChange, onSaveRoute, savingRoute, savedRoute, testMode,
}) {
  const [tempSource, setTempSource] = useState("");
  const [tempDest,   setTempDest]   = useState("");
  const [showRoute,  setShowRoute]  = useState(false);

  const asgn     = resolveAssignmentForDb(allAssignments, mlVehicleId, currentMin);
  const trips    = allTripsForMlId(allAssignments, mlVehicleId ?? "");
  const mlHostel = asgn?.hostel ?? null;
  const mlSrc    = mlHostel ? findStopByName(mlHostel) : null;

  const srcId = tempSource || mlSrc?.id  || (bus.route?.[0]?.id ?? "");
  const dstId = tempDest   || campus25Stop?.id || (bus.route?.[bus.route?.length - 1]?.id ?? "");

  const capacity     = bus.vehicle_type === "Shuttle" ? 20 : 60;
  const mlSaysActive = asgn?.status === "active";
  const mlSaysIdle   = !asgn || asgn.status === "done";

  const leftBorder =
    !isAllocated             ? "border-l-slate-300" :
    bus.status === "active"      ? "border-l-emerald-400" :
    bus.status === "maintenance" ? "border-l-red-400" : "border-l-amber-300";

  const iconBg =
    !isAllocated             ? "bg-slate-100 text-slate-400" :
    bus.status === "active"      ? "bg-emerald-100 text-emerald-700" :
    bus.status === "maintenance" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500";

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${leftBorder} shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col ${!isAllocated ? "opacity-60" : ""}`}>

      {/* Top row */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
            {bus.vehicle_type === "Shuttle" ? <Truck size={20} /> : <Bus size={20} />}
          </div>
          <div>
            <p className="font-bold text-slate-800 text-base leading-tight">{bus.bus_code}</p>
            <p className="text-xs text-slate-400">
              {bus.vehicle_type ?? "Bus"} · Cap {capacity}
              {mlVehicleId && <span className="ml-1.5 text-indigo-400 font-mono">({mlVehicleId})</span>}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusPill status={bus.status} />
          {isAllocated
            ? <AssignBadge status={asgn?.status} />
            : <span className="text-[10px] text-slate-400 italic">Not in ML plan</span>}
        </div>
      </div>

      {/* ML assignment box */}
      {isAllocated && asgn && (
        <div className={`mx-4 mb-3 px-3 py-2.5 rounded-xl border
          ${asgn.status === "active"   ? "bg-emerald-50 border-emerald-200" :
            asgn.status === "upcoming" ? "bg-blue-50 border-blue-200" :
            "bg-slate-50 border-slate-200"}`}>
          <div className="flex items-center gap-2 mb-1">
            <BrainCircuit size={12} className={
              asgn.status === "active" ? "text-emerald-600" :
              asgn.status === "upcoming" ? "text-blue-500" : "text-slate-400"} />
            <span className={`text-xs font-semibold
              ${asgn.status === "active" ? "text-emerald-700" :
                asgn.status === "upcoming" ? "text-blue-700" : "text-slate-500"}`}>
              {asgn.status === "active" ? "Currently serving" :
               asgn.status === "upcoming" ? "Next assignment" : "Last assignment"}
            </span>
            <span className="ml-auto text-[10px] font-mono text-slate-400">R{asgn.round} · {asgn.time_slot}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <MapPin size={12} className="text-slate-400 shrink-0" />
            <span className="font-semibold">{asgn.hostel}</span>
            <ArrowRight size={11} className="text-slate-400" />
            <span>Campus 25</span>
            <span className="ml-auto text-[10px] font-mono text-slate-400">{asgn.start_time}–{asgn.end_time}</span>
          </div>
          {asgn.students > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-slate-500 shrink-0">{asgn.students}/{capacity}</span>
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-1.5 rounded-full ${asgn.status === "active" ? "bg-emerald-400" : "bg-blue-300"}`}
                  style={{ width: `${Math.min(100, (asgn.students / capacity) * 100)}%` }} />
              </div>
            </div>
          )}
          <TripTimeline trips={trips} currentMin={currentMin} />
        </div>
      )}

      {/* Allocated but no assignment at this time */}
      {isAllocated && !asgn && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-400 flex flex-col gap-1">
          <div className="flex items-center gap-1.5"><Clock size={11} /> No assignment at this time</div>
          <TripTimeline trips={trips} currentMin={currentMin} />
        </div>
      )}

      {/* DB route */}
      <div className="px-5 pb-3 flex items-center gap-1.5 text-xs text-slate-500">
        <MapPin size={11} className="text-slate-400 shrink-0" />
        <span className="font-medium text-slate-600">DB Route:</span>
        {bus.route?.length > 0
          ? <span>{bus.route[0].name} <span className="text-slate-300 mx-0.5">→</span> {bus.route[bus.route.length - 1].name}</span>
          : <span className="italic text-slate-400">No route assigned</span>}
      </div>

      {/* Footer actions */}
      <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2 flex-wrap mt-auto">
        <select value={bus.status} onChange={e => onStatusChange(bus.bus_id, e.target.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer outline-none
            ${bus.status === "active"      ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
              bus.status === "maintenance" ? "bg-red-50 border-red-200 text-red-700" :
              "bg-amber-50 border-amber-200 text-amber-700"}`}>
          <option value="active">Running</option>
          <option value="idle">Idle</option>
          <option value="maintenance">Maintenance</option>
        </select>

        {isAllocated && mlSaysActive && bus.status !== "active" && bus.status !== "maintenance" && (
          <button onClick={() => onStatusChange(bus.bus_id, "active")}
            className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-100 transition-colors">
            <Zap size={10} /> Set Active
          </button>
        )}
        {isAllocated && mlSaysIdle && bus.status === "active" && (
          <button onClick={() => onStatusChange(bus.bus_id, "idle")}
            className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors">
            <Zap size={10} /> Set Idle
          </button>
        )}

        <button onClick={() => setShowRoute(r => !r)}
          className="ml-auto text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 font-medium">
          <MapPin size={11} /> {showRoute ? "Hide" : "Route"}
        </button>
      </div>

      {/* Route edit panel */}
      {showRoute && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex flex-col gap-2 rounded-b-2xl">
          {testMode && (
            <p className="text-[10px] text-amber-600 flex items-center gap-1">
              <FlaskConical size={10} /> Test mode — route will be saved to DB
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <select value={srcId} onChange={e => setTempSource(Number(e.target.value))}
              className="border rounded-lg px-2 py-1.5 text-xs bg-white flex-1 min-w-[110px]">
              <option value="">Source stop</option>
              {stops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ArrowRight size={12} className="text-slate-400 shrink-0" />
            <select value={dstId} onChange={e => setTempDest(Number(e.target.value))}
              className="border rounded-lg px-2 py-1.5 text-xs bg-white flex-1 min-w-[110px]">
              <option value="">Destination stop</option>
              {stops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={() => onSaveRoute(bus.bus_id, [srcId, dstId])}
              disabled={savingRoute[bus.bus_id] || !srcId || !dstId}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all
                ${savedRoute[bus.bus_id] ? "bg-emerald-500 text-white" :
                  !srcId || !dstId ? "bg-slate-200 text-slate-400 cursor-not-allowed" :
                  "bg-slate-800 hover:bg-slate-900 text-white"}`}>
              {savingRoute[bus.bus_id] ? <RefreshCw size={11} className="animate-spin" />
                : savedRoute[bus.bus_id] ? <><CheckCircle2 size={11} /> Saved</> : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────
export default function Vehicles() {
  const [buses,        setBuses]        = useState([]);
  const [stops,        setStops]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [mlData,       setMlData]       = useState(null);
  const [savingRoute,  setSavingRoute]  = useState({});
  const [savedRoute,   setSavedRoute]   = useState({});
  const [applyingAll,  setApplyingAll]  = useState(false);
  const [autoSync,     setAutoSync]     = useState(false);
  const [testMode,     setTestMode]     = useState(false);
  const [testMinutes,  setTestMinutes]  = useState(8 * 60 + 30);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showUnalloc,  setShowUnalloc]  = useState(false);
  const [syncState,    setSyncState]    = useState("idle");
  const [, setTick]                    = useState(0);
  const timerRef = useRef(null);

  // 30-second clock tick
  useEffect(() => {
    timerRef.current = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(timerRef.current);
  }, []);

  // ── Data fetching — defined first so nothing references undefined ──
  const fetchBusRoutes = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/getBusRoutes`, { credentials: "include" });
      const data = await res.json();
      setBuses(Array.isArray(data) ? data : []);
    } catch (_) { setBuses([]); }
    finally { setLoading(false); }
  }, []);

  const fetchStops = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/getStops`, { credentials: "include" });
      const data = await res.json();
      setStops(Array.isArray(data) ? data : []);
    } catch (_) {}
  }, []);

  const loadMLData = useCallback(() => {
    try {
      const s = sessionStorage.getItem(ML_STORAGE_KEY);
      if (s) setMlData(JSON.parse(s));
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchBusRoutes(); fetchStops(); loadMLData();
  }, [fetchBusRoutes, fetchStops, loadMLData]);

  // ── Status update (optimistic) ────────────────────────────
  const updateStatus = useCallback(async (busId, newStatus) => {
    setBuses(prev => prev.map(b => b.bus_id === busId ? { ...b, status: newStatus } : b));
    try {
      await fetch(`${API_BASE}/admin/updateBusStatus`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ busId, status: newStatus }),
      });
    } catch (_) { fetchBusRoutes(); }
  }, [fetchBusRoutes]);

  // ── Route save ────────────────────────────────────────────
  const handleSaveRoute = useCallback(async (busId, stopIds) => {
    if (!stopIds[0] || !stopIds[1]) return;
    setSavingRoute(p => ({ ...p, [busId]: true }));
    try {
      await fetch(`${API_BASE}/admin/updateBusRoute`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ busId, stopIds }),
      });
      setSavedRoute(p => ({ ...p, [busId]: true }));
      setTimeout(() => setSavedRoute(p => ({ ...p, [busId]: false })), 2000);
      fetchBusRoutes();
    } catch (_) {}
    finally { setSavingRoute(p => ({ ...p, [busId]: false })); }
  }, [fetchBusRoutes]);

  // ── Sync fleet DB statuses to ML counts ───────────────────
  const syncFleetToML = useCallback(async (mlBusCount) => {
    setSyncState("syncing");
    try {
      const res = await fetch(`${API_BASE}/admin/syncFleetStatus`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mlBusCount }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSyncState("done");
      setTimeout(() => setSyncState("idle"), 3000);
      await fetchBusRoutes();
    } catch (err) {
      console.error("Fleet sync failed:", err);
      setSyncState("error");
      setTimeout(() => setSyncState("idle"), 4000);
    }
  }, [fetchBusRoutes]);

  // ── Auto-sync ML → DB status ──────────────────────────────
  const doAutoSync = useCallback(async (busesSnap, assignmentsSnap, dbToMlIdSnap, allocatedSnap, minute) => {
    for (const bus of busesSnap) {
      if (bus.status === "maintenance") continue;
      if (!allocatedSnap.has(bus.bus_id)) continue;
      const mlId   = dbToMlIdSnap[bus.bus_id];
      const asgn   = resolveAssignmentForDb(assignmentsSnap, mlId, minute);
      const target = asgn?.status === "active" ? "active" : "idle";
      if (bus.status !== target) await updateStatus(bus.bus_id, target);
    }
  }, [updateStatus]);

  // ── Derived values ────────────────────────────────────────
  const currentMin     = testMode ? testMinutes : nowMin();
  const allAssignments = flattenAssignments(mlData);
  const mlToDb         = mlData ? buildMlToDbMap(buses, mlData) : {};

  const dbToMlId = {};
  Object.entries(mlToDb).forEach(([mlId, { bus_id }]) => { dbToMlId[bus_id] = mlId; });

  const allocatedBusIds = new Set(Object.values(mlToDb).map(v => v.bus_id));
  const { buses: mlBusCount, shuttles: mlShuttleCount } = countMlAllocated(mlData);

  const findStopByName = useCallback((name) => {
    if (!name || !stops.length) return null;
    const lower = name.toLowerCase().trim();
    return (
      stops.find(s => s.name.toLowerCase() === lower) ??
      stops.find(s => s.name.toLowerCase().includes(lower)) ??
      stops.find(s => lower.includes(s.name.toLowerCase())) ?? null
    );
  }, [stops]);

  const campus25Stop =
    stops.find(s => s.name.replace(/\s/g, "").toLowerCase() === "campus25") ??
    stops.find(s => s.name.toLowerCase().includes("campus") && s.name.includes("25")) ?? null;

  useEffect(() => {
    if (autoSync && mlData && buses.length) {
      doAutoSync(buses, allAssignments, dbToMlId, allocatedBusIds, currentMin);
    }
  }, [autoSync, currentMin]); // eslint-disable-line

  // ── Apply ML routes to all allocated buses ────────────────
  const applyMLRoutesToAll = useCallback(async () => {
    if (!campus25Stop) { alert("Campus 25 stop not found in DB."); return; }
    setApplyingAll(true);
    for (const bus of buses) {
      if (!allocatedBusIds.has(bus.bus_id)) continue;
      const mlId = dbToMlId[bus.bus_id];
      const asgn = resolveAssignmentForDb(allAssignments, mlId, currentMin);
      if (!asgn?.hostel) continue;
      const src = findStopByName(asgn.hostel);
      if (!src || src.id === campus25Stop.id) continue;
      await handleSaveRoute(bus.bus_id, [src.id, campus25Stop.id]);
    }
    setApplyingAll(false);
  }, [buses, allAssignments, dbToMlId, allocatedBusIds, currentMin, campus25Stop, findStopByName, handleSaveRoute]);

  // ── Stats ─────────────────────────────────────────────────
  const allocatedBuses = buses.filter(b => allocatedBusIds.has(b.bus_id));
  const unallocated    = buses.filter(b => !allocatedBusIds.has(b.bus_id));
  const stats = {
    total:       buses.length,
    allocated:   allocatedBusIds.size,
    running:     allocatedBuses.filter(b => b.status === "active").length,
    idle:        allocatedBuses.filter(b => b.status === "idle").length,
    maintenance: buses.filter(b => b.status === "maintenance").length,
  };

  const PRIORITY = { active: 0, upcoming: 1, done: 2 };
  const sortedAllocated = allocatedBuses
    .filter(b => filterStatus === "all" || b.status === filterStatus)
    .sort((a, b) => {
      const pa = PRIORITY[resolveAssignmentForDb(allAssignments, dbToMlId[a.bus_id], currentMin)?.status ?? ""] ?? 3;
      const pb = PRIORITY[resolveAssignmentForDb(allAssignments, dbToMlId[b.bus_id], currentMin)?.status ?? ""] ?? 3;
      return pa - pb;
    });

  const QUICK_TIMES = ["08:00","08:30","08:50","09:00","09:30","10:00","10:30","11:00","13:30","14:00","14:30","15:00"];

  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f6fa] p-5 md:p-8">
      <AdminNavbar />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Vehicle Fleet</h1>
          <p className="text-slate-500 text-sm mt-1">
            {mlData
              ? `ML plan uses ${mlBusCount} bus${mlBusCount !== 1 ? "es" : ""} + ${mlShuttleCount} shuttle${mlShuttleCount !== 1 ? "s" : ""} · ${buses.length} total in DB`
              : `${buses.length} vehicles in DB · No ML plan loaded`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Clock */}
          <div className={`flex items-center gap-1.5 text-sm font-mono px-3 py-2 rounded-xl border
            ${testMode ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-white border-slate-200 text-slate-600"}`}>
            {testMode ? <FlaskConical size={13} className="text-amber-500" /> : <Radio size={13} className="text-emerald-500 animate-pulse" />}
            {toDisplay(currentMin)}
          </div>

          {/* Auto-sync toggle */}
          {mlData && (
            <button
              onClick={() => {
                const next = !autoSync;
                setAutoSync(next);
                if (next) doAutoSync(buses, allAssignments, dbToMlId, allocatedBusIds, currentMin);
              }}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all
                ${autoSync ? "bg-indigo-600 border-indigo-600 text-white shadow-md" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
              <Zap size={13} /> {autoSync ? "Auto-Sync ON" : "Auto-Sync"}
            </button>
          )}

          {/* Test mode */}
          <button onClick={() => setTestMode(t => !t)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors
              ${testMode ? "bg-amber-100 border-amber-300 text-amber-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
            <FlaskConical size={13} /> {testMode ? "Exit Test Mode" : "Test Mode"}
          </button>

          {/* Apply ML routes */}
          {mlData && (
            <button onClick={applyMLRoutesToAll} disabled={applyingAll}
              className="flex items-center gap-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl transition-colors">
              {applyingAll ? <RefreshCw size={13} className="animate-spin" /> : <BrainCircuit size={13} />}
              Apply ML Routes
            </button>
          )}

          {/* Sync DB Status */}
          {mlData && (
            <button onClick={() => syncFleetToML(mlBusCount + mlShuttleCount)}
              disabled={syncState === "syncing"}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all
                ${syncState === "done"    ? "bg-emerald-100 border-emerald-300 text-emerald-700" :
                  syncState === "error"   ? "bg-red-100 border-red-300 text-red-700" :
                  syncState === "syncing" ? "bg-slate-100 border-slate-300 text-slate-500" :
                  "bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700"}`}>
              {syncState === "syncing" ? <RefreshCw size={13} className="animate-spin" /> :
               syncState === "done"    ? <CheckCircle2 size={13} /> :
               syncState === "error"   ? <AlertTriangle size={13} /> :
               <Activity size={13} />}
              {syncState === "syncing" ? "Syncing…" :
               syncState === "done"    ? "Synced!" :
               syncState === "error"   ? "Sync failed" : "Sync DB Status"}
            </button>
          )}

          {/* Refresh */}
          <button onClick={() => { fetchBusRoutes(); loadMLData(); setTick(t => t + 1); }}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl px-3 py-2 bg-white hover:bg-slate-50 transition-colors">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* STATS STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total in DB",  value: stats.total,       Icon: Bus,           color: "text-slate-700",   bg: "bg-white",      f: null },
          { label: "ML Allocated", value: stats.allocated,   Icon: BrainCircuit,  color: "text-indigo-700",  bg: "bg-indigo-50",  f: null },
          { label: "Running",      value: stats.running,     Icon: Activity,      color: "text-emerald-700", bg: "bg-emerald-50", f: "active" },
          { label: "Idle",         value: stats.idle,        Icon: Clock,         color: "text-amber-700",   bg: "bg-amber-50",   f: "idle" },
          { label: "Maintenance",  value: stats.maintenance, Icon: AlertTriangle, color: "text-red-700",     bg: "bg-red-50",     f: "maintenance" },
        ].map(({ label, value, Icon, color, bg, f }) => (
          <button key={label} onClick={() => f && setFilterStatus(f === filterStatus ? "all" : f)}
            className={`${bg} rounded-2xl border p-4 flex items-center gap-3 text-left w-full transition-all
              ${f ? "hover:shadow-md cursor-pointer active:scale-[0.98]" : "cursor-default"}
              ${filterStatus === f && f ? "ring-2 ring-inset ring-indigo-400 border-indigo-200 shadow-sm" : "border-slate-200"}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg === "bg-white" ? "bg-slate-100" : "bg-white/60"}`}>
              <Icon size={16} className={color} />
            </div>
            <div>
              <p className={`text-xl font-black ${color}`}>{value}</p>
              <p className="text-xs text-slate-500 font-medium">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* TEST MODE PANEL */}
      {testMode && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical size={15} className="text-amber-600" />
            <span className="text-sm font-bold text-amber-800">Test Mode</span>
            <span className="text-xs text-amber-600">— simulating</span>
            <span className="font-mono text-sm font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">{toDisplay(testMinutes)}</span>
            <span className="text-[10px] text-amber-500 ml-2">Route saves are real and affect the public dashboard</span>
          </div>
          <input type="range" min={0} max={23 * 60 + 59} step={1} value={testMinutes}
            onChange={e => setTestMinutes(Number(e.target.value))}
            className="w-full accent-amber-500 mb-2" />
          <div className="flex justify-between text-[10px] text-amber-500 font-mono mb-3">
            {["00:00","06:00","09:00","12:00","15:00","18:00","23:59"].map(t => <span key={t}>{t}</span>)}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-xs text-amber-700 font-semibold mr-1 self-center">Jump to:</span>
            {QUICK_TIMES.map(t => (
              <button key={t} onClick={() => setTestMinutes(toMin(t))}
                className={`text-xs font-mono px-2.5 py-1 rounded-lg border transition-colors
                  ${testMinutes === toMin(t) ? "bg-amber-500 text-white border-amber-500" : "bg-white border-amber-200 text-amber-700 hover:bg-amber-100"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* NO ML WARNING */}
      {!mlData && (
        <div className="mb-6 flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-5 py-3.5 text-sm text-slate-500">
          <WifiOff size={16} className="shrink-0 text-slate-400" />
          No ML allocation loaded. Run the simulation on the{" "}
          <strong className="mx-1 text-indigo-600">AI Predictions</strong> page first.
        </div>
      )}

      {/* SYNC STATUS BANNER */}
      {syncState === "done" && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 text-xs text-emerald-700 font-semibold">
          <CheckCircle2 size={14} />
          DB synced — first {mlBusCount} bus{mlBusCount !== 1 ? "es" : ""} set to Running, rest set to Idle.
          Dashboard will now show correct counts.
        </div>
      )}
      {syncState === "error" && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-xs text-red-700 font-semibold">
          <AlertTriangle size={14} /> Fleet sync failed. Check backend connection and try again.
        </div>
      )}

      {/* MISMATCH WARNING */}
      {mlData && syncState === "idle" && stats.running !== mlBusCount && (
        <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-xs text-amber-800">
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <span>
            <strong>Status mismatch:</strong> DB shows {stats.running} running but ML allocated {mlBusCount}.
            Click <strong>Sync DB Status</strong> to fix.
          </span>
        </div>
      )}

      {/* AUTO-SYNC NOTICE */}
      {autoSync && mlData && (
        <div className="mb-5 flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3 text-xs text-indigo-700 font-medium">
          <Zap size={14} /> Auto-Sync active — only ML-allocated vehicles are updated. Maintenance vehicles are never changed.
        </div>
      )}

      {/* FILTER + UNALLOCATED TOGGLE */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Gauge size={14} className="text-slate-400" />
        <span className="text-xs text-slate-500 font-medium">Filter:</span>
        {[
          { key: "all",         label: `All (${stats.allocated})` },
          { key: "active",      label: `Running (${stats.running})` },
          { key: "idle",        label: `Idle (${stats.idle})` },
          { key: "maintenance", label: `Maintenance (${stats.maintenance})` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilterStatus(key)}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors
              ${filterStatus === key ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            {label}
          </button>
        ))}
        {unallocated.length > 0 && (
          <button onClick={() => setShowUnalloc(v => !v)}
            className={`ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors
              ${showUnalloc ? "bg-slate-200 border-slate-300 text-slate-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
            <Info size={12} />
            {showUnalloc ? "Hide" : "Show"} {unallocated.length} unallocated
          </button>
        )}
      </div>

      {/* VEHICLE GRID */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 h-44 animate-pulse" />
          ))}
        </div>
      ) : sortedAllocated.length === 0 && !showUnalloc ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Bus size={36} className="opacity-30" />
          <p className="font-medium text-slate-500">
            {mlData ? "No allocated vehicles match this filter" : "No vehicles found in DB"}
          </p>
          {filterStatus !== "all" && (
            <button onClick={() => setFilterStatus("all")} className="text-xs text-indigo-500 hover:underline">
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <>
          {sortedAllocated.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              {sortedAllocated.map(bus => (
                <VehicleCard key={bus.bus_id} bus={bus}
                  mlVehicleId={dbToMlId[bus.bus_id] ?? null}
                  isAllocated={true}
                  stops={stops} allAssignments={allAssignments} currentMin={currentMin}
                  campus25Stop={campus25Stop} findStopByName={findStopByName}
                  onStatusChange={updateStatus} onSaveRoute={handleSaveRoute}
                  savingRoute={savingRoute} savedRoute={savedRoute} testMode={testMode}
                />
              ))}
            </div>
          )}

          {showUnalloc && unallocated.length > 0 && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium px-2">
                  {unallocated.length} vehicles not in current ML plan
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {unallocated.map(bus => (
                  <VehicleCard key={bus.bus_id} bus={bus}
                    mlVehicleId={null} isAllocated={false}
                    stops={stops} allAssignments={allAssignments} currentMin={currentMin}
                    campus25Stop={campus25Stop} findStopByName={findStopByName}
                    onStatusChange={updateStatus} onSaveRoute={handleSaveRoute}
                    savingRoute={savingRoute} savedRoute={savedRoute} testMode={testMode}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}