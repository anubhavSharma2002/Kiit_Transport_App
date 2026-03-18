import React, { useEffect, useState, useCallback } from "react";
import {
  User, Phone, Bus, Search, RefreshCw, ChevronDown,
  AlertCircle, Plus, X, Eye, EyeOff, CheckCircle2,
  Send, BrainCircuit, Clock, Truck, MessageSquare,
  Copy, Check, FlaskConical, Radio, MapPin,
} from "lucide-react";
import API_BASE from "../apiBase";
import AdminNavbar from "../components/AdminNavbar";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const ML_STORAGE_KEY  = "kiit_ml_allocation";
const QUICK_TIMES     = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00"];

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  active:      { label:"Active",      pill:"bg-emerald-100 text-emerald-700 border-emerald-200", dot:"bg-emerald-500", row:"hover:bg-emerald-50/30", border:"border-l-emerald-400" },
  idle:        { label:"Idle",        pill:"bg-amber-100 text-amber-700 border-amber-200",       dot:"bg-amber-400",   row:"hover:bg-amber-50/20",   border:"border-l-amber-400"   },
  maintenance: { label:"Maintenance", pill:"bg-red-100 text-red-700 border-red-200",             dot:"bg-red-500",     row:"hover:bg-red-50/20",     border:"border-l-red-400"     },
};
const STATUS_ORDER = { active:0, idle:1, maintenance:2 };
const AVATAR_COLORS = [
  "from-blue-200 to-indigo-200 text-indigo-700",
  "from-violet-200 to-purple-200 text-purple-700",
  "from-teal-200 to-cyan-200 text-teal-700",
  "from-rose-200 to-pink-200 text-rose-700",
  "from-amber-200 to-yellow-200 text-amber-700",
];

function getStatusCfg(status) {
  return STATUS_CFG[status?.toLowerCase()] ?? {
    label: status || "Unknown", pill:"bg-slate-100 text-slate-500 border-slate-200",
    dot:"bg-slate-400", row:"hover:bg-slate-50", border:"border-l-slate-300",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TIME HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const toMin     = t => { if (!t) return null; const [h,m] = t.split(":").map(Number); return h*60+m; };
const toDisplay = m => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
const nowMin    = () => { const d = new Date(); return d.getHours()*60 + d.getMinutes(); };

// ─────────────────────────────────────────────────────────────────────────────
// ML DATA HELPERS
//
// MLPredictions.jsx stores to sessionStorage["kiit_ml_allocation"]:
//   { phase1, phase2, timetable, savedAt }
//
// Where:
//   phase1.first_round_assignments[]  → { vehicle_id, vehicle_type, hostel,
//       time_slot, start_time, end_time, students_assigned, ... }
//   phase2.second_round_assignments[] → { vehicle_id, vehicle_type, to_hostel,
//       time_slot, start_time, arrival_time, students_assigned, round:2, ... }
//
// NOTE: The top-level `timetable` key is a simplified display-only table
// (only vehicle_id + time + hostel). We must read from phase1/phase2 directly
// to get full trip data with start_time, end_time, students_assigned etc.
//
// We match driver.vehicle (e.g. "BUS-01") case-insensitively to vehicle_id.
// ─────────────────────────────────────────────────────────────────────────────

// Parse sessionStorage — returns { phase1, phase2, savedAt } or null
function readMLStorage() {
  try {
    const raw = sessionStorage.getItem(ML_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Shape written by MLPredictions.jsx:
    //   { phase1, phase2, timetable, savedAt }
    // Support also nested: { result: { phase1, phase2 } }
    const phase1 = parsed?.phase1 ?? parsed?.result?.phase1 ?? null;
    const phase2 = parsed?.phase2 ?? parsed?.result?.phase2 ?? null;
    if (!phase1) return null;
    return { phase1, phase2, savedAt: parsed.savedAt ?? null };
  } catch { return null; }
}

// Build full trip list from phase1 + phase2 assignments, normalised to a
// consistent shape so trip-time helpers work uniformly.
function buildAllTrips(phase1, phase2) {
  const trips = [];

  for (const a of phase1?.first_round_assignments ?? []) {
    trips.push({
      vehicle_id:        a.vehicle_id,
      vehicle_type:      a.vehicle_type ?? "Bus",
      round:             1,
      to_hostel:         a.hostel,          // phase1 uses `hostel`
      time_slot:         a.time_slot,
      start_time:        a.start_time,
      end_time:          a.end_time,        // phase1 uses `end_time`
      students_assigned: a.students_assigned,
    });
  }

  for (const a of phase2?.second_round_assignments ?? []) {
    trips.push({
      vehicle_id:        a.vehicle_id,
      vehicle_type:      a.vehicle_type ?? "Bus",
      round:             2,
      to_hostel:         a.to_hostel,       // phase2 uses `to_hostel`
      time_slot:         a.time_slot,
      start_time:        a.start_time,
      end_time:          a.arrival_time,    // phase2 uses `arrival_time`
      students_assigned: a.students_assigned,
    });
  }

  return trips;
}

// vehicle_id (lowercase) → trips[], sorted by start_time
function buildVehicleTripMap(phase1, phase2) {
  const allTrips = buildAllTrips(phase1, phase2);
  const map = {};
  for (const t of allTrips) {
    const key = t.vehicle_id?.toLowerCase();
    if (!key) continue;
    (map[key] = map[key] ?? []).push(t);
  }
  for (const k of Object.keys(map))
    map[k].sort((a,b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  return map;
}

// Find the trip a vehicle is currently on at `currentMin`
// A trip is "active" when: start_time ≤ now < end_time (or arrival_time)
function getCurrentTrip(trips, currentMin) {
  if (!trips?.length) return null;
  return trips.find(t => {
    const dep = toMin(t.start_time);
    const arr = toMin(t.end_time ?? t.arrival_time);
    return dep !== null && arr !== null && currentMin >= dep && currentMin < arr;
  }) ?? null;
}

// Find the next upcoming trip for a vehicle at `currentMin`
function getNextTrip(trips, currentMin) {
  if (!trips?.length) return null;
  return trips
    .filter(t => toMin(t.start_time) > currentMin)
    .sort((a,b) => toMin(a.start_time) - toMin(b.start_time))[0] ?? null;
}

// WhatsApp-style dispatch message for one driver
function buildDispatchMessage(driver, trips) {
  if (!trips?.length)
    return `🚌 Hi ${driver.name}, no trips are allocated to your vehicle (${driver.vehicle}) in today's ML plan. Please stand by for further instructions.`;

  const date = new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"short" });
  const lines = [
    `🚌 *KIIT Transport — Dispatch for ${date}*`,
    ``,
    `Hi *${driver.name}*, your schedule for vehicle *${driver.vehicle}*:`,
    ``,
  ];
  trips.forEach((t, i) => {
    const dest = t.to_hostel ?? t.hostel ?? "Campus";
    const dep  = t.start_time ?? "—";
    const arr  = t.end_time ?? t.arrival_time ?? "—";
    const cls  = t.time_slot ?? "—";
    const r2   = t.round === 2 ? " *(Return Run)*" : "";
    lines.push(`*Trip ${i+1}${r2}*`);
    lines.push(`  📍 → ${dest}`);
    lines.push(`  🕐 Class: ${cls}  |  Depart: ${dep}  |  Arrive: ${arr}`);
    lines.push(`  👥 ${t.students_assigned ?? "—"} students`);
    lines.push(``);
  });
  lines.push(`Please be ready *30 min before* each departure. Contact transport desk for issues.`);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────────────────
function DriverAvatar({ name, idx }) {
  const color    = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  const initials = name ? name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() : "?";
  return (
    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${color}
      flex items-center justify-center font-black text-sm shrink-0 shadow-sm select-none`}>
      {initials}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = getStatusCfg(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
      text-[11px] font-bold uppercase tracking-wide border ${cfg.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// Small pill shown in table — driver's current trip at simulated time
function TripPill({ trips, currentMin }) {
  const cur  = getCurrentTrip(trips, currentMin);
  const next = !cur ? getNextTrip(trips, currentMin) : null;

  if (cur) {
    const dest = cur.to_hostel ?? cur.hostel ?? "—";
    return (
      <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200
        text-emerald-700 text-[11px] font-semibold px-2.5 py-1 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <MapPin size={10} />
        <span className="font-mono font-bold">{cur.start_time}</span>
        <span>→ {dest}</span>
      </div>
    );
  }
  if (next) {
    return (
      <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200
        text-blue-600 text-[11px] font-semibold px-2.5 py-1 rounded-full">
        <Clock size={10} />
        <span>Next:</span>
        <span className="font-mono font-bold">{next.start_time}</span>
        <span className="text-blue-500">→ {next.to_hostel ?? next.hostel ?? "—"}</span>
      </div>
    );
  }
  return <span className="text-[11px] text-slate-400 italic">No active trip</span>;
}

function StatChips({ drivers }) {
  const counts = drivers.reduce((acc, d) => {
    const k = d.status?.toLowerCase() ?? "unknown";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  return (
    <div className="flex flex-wrap gap-2">
      {[
        { label:"Active",      count: counts.active      ?? 0, color:"text-emerald-700 bg-emerald-50 border-emerald-200" },
        { label:"Idle",        count: counts.idle        ?? 0, color:"text-amber-700 bg-amber-50 border-amber-200" },
        { label:"Maintenance", count: counts.maintenance ?? 0, color:"text-red-700 bg-red-50 border-red-200" },
      ].map(c => (
        <span key={c.label} className={`inline-flex items-center gap-1.5 text-xs font-bold
          px-3 py-1.5 rounded-xl border ${c.color}`}>
          <span className="text-base font-black">{c.count}</span>
          {c.label}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD DRIVER MODAL  (POST /auth/register  role="driver")
// ─────────────────────────────────────────────────────────────────────────────
function AddDriverModal({ onClose, onSuccess }) {
  const [form,       setForm]   = useState({ name:"", email:"", phone:"", password:"" });
  const [showPwd,    setShowPwd] = useState(false);
  const [submitting, setSub]    = useState(false);
  const [error,      setError]  = useState(null);
  const [success,    setSuccess]= useState(false);

  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  const validate = () => {
    if (!form.name.trim())    return "Name is required";
    if (!form.email.trim())   return "Email is required";
    if (!form.email.endsWith("@kiit.ac.in")) return "Must be a @kiit.ac.in email";
    if (!form.phone.trim())   return "Phone number is required";
    if (!/^\d{10}$/.test(form.phone.trim())) return "Phone must be exactly 10 digits";
    if (!form.password)       return "Password is required";
    if (form.password.length < 6) return "Password must be at least 6 characters";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSub(true); setError(null);
    try {
      const res  = await fetch(`${API_BASE}/auth/register`, {
        method:"POST", credentials:"include",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ ...form, role:"driver" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? `Server error ${res.status}`);
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (e) {
      setError(e.message);
    } finally { setSub(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <User size={18} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 leading-none">Add New Driver</h2>
              <p className="text-xs text-slate-400 mt-0.5">Creates a driver account</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {success ? (
            <div className="flex flex-col items-center py-6 text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <p className="font-bold text-slate-700">Driver registered successfully!</p>
              <p className="text-xs text-slate-400">They can now log in with their KIIT email.</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-3 text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {[
                { key:"name",     label:"Full Name",    placeholder:"e.g. Rahul Kumar",      type:"text"  },
                { key:"email",    label:"KIIT Email",   placeholder:"driver@kiit.ac.in",      type:"email", note:"@kiit.ac.in only" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    {f.label}
                    {f.note && <span className="ml-1.5 text-slate-400 font-normal">({f.note})</span>}
                  </label>
                  <input type={f.type} placeholder={f.placeholder} value={form[f.key]}
                    onChange={e => set(f.key, e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-400 transition" />
                </div>
              ))}

              {/* Phone with +91 prefix */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Phone Number</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-semibold">+91</span>
                  <input type="tel" placeholder="10-digit number" value={form.phone}
                    onChange={e => set("phone", e.target.value.replace(/\D/g,"").slice(0,10))}
                    className="w-full pl-12 pr-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-400 transition font-mono" />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPwd ? "text" : "password"} placeholder="Min. 6 characters" value={form.password}
                    onChange={e => set("password", e.target.value)}
                    className="w-full px-3.5 pr-10 py-2.5 text-sm bg-white border border-slate-200 rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-400 transition" />
                  <button type="button" onClick={() => setShowPwd(v=>!v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 bg-slate-50 rounded-xl px-3 py-2.5 leading-relaxed">
                ℹ️ The driver can log in immediately. A bus must be assigned via the database.
              </p>
            </>
          )}
        </div>

        {!success && (
          <div className="px-6 pb-6 flex gap-3">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700
                disabled:opacity-60 rounded-xl transition-colors flex items-center justify-center gap-2">
              {submitting ? <><RefreshCw size={14} className="animate-spin"/> Registering…</> : <><Plus size={14}/> Add Driver</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Diagnostic component — shown only when ML panel opens but finds no data
// Reads sessionStorage directly so we can see the raw keys
function DiagPanel() {
  const [info, setInfo] = React.useState(null);
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ML_STORAGE_KEY);
      if (!raw) { setInfo({ status: "empty", msg: "sessionStorage key not found" }); return; }
      const parsed = JSON.parse(raw);
      const keys = Object.keys(parsed);
      const p1keys = parsed.phase1 ? Object.keys(parsed.phase1) : null;
      const count1 = parsed.phase1?.first_round_assignments?.length ?? 0;
      const count2 = parsed.phase2?.second_round_assignments?.length ?? 0;
      setInfo({ status: "found", keys, p1keys, count1, count2 });
    } catch(e) { setInfo({ status: "error", msg: e.message }); }
  }, []);
  if (!info) return null;
  return (
    <div className="w-full max-w-sm bg-slate-50 border border-slate-200 rounded-xl p-3 text-left text-[11px] font-mono text-slate-600 space-y-1">
      <p className="font-bold text-slate-800 not-italic text-xs mb-1">🔍 Storage Diagnostic</p>
      {info.status === "empty" && <p className="text-red-600">{info.msg}</p>}
      {info.status === "error" && <p className="text-red-600">Parse error: {info.msg}</p>}
      {info.status === "found" && (
        <>
          <p>Top-level keys: <span className="text-indigo-600">{info.keys.join(", ")}</span></p>
          <p>phase1 sub-keys: <span className="text-indigo-600">{info.p1keys?.join(", ") ?? "none"}</span></p>
          <p>phase1 assignments: <span className="text-emerald-600 font-bold">{info.count1}</span></p>
          <p>phase2 assignments: <span className="text-emerald-600 font-bold">{info.count2}</span></p>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BROADCAST PANEL — ML dispatch messages per driver
// currentMin is passed in so it can highlight the "active right now" trip
// ─────────────────────────────────────────────────────────────────────────────
function BroadcastPanel({ drivers, phase1, phase2, savedAt, currentMin, onClose }) {
  const vehicleMap    = buildVehicleTripMap(phase1, phase2);
  const hasML         = !!(phase1?.first_round_assignments?.length);
  const driversWithBus = drivers.filter(d => d.vehicle);

  const [copied,   setCopied]   = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [sentAll,  setSentAll]  = useState(false);

  const copyMessage = (driver, trips) => {
    navigator.clipboard.writeText(buildDispatchMessage(driver, trips)).then(() => {
      setCopied(driver.name);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const copyAll = () => {
    const all = driversWithBus.map(d => {
      const trips = vehicleMap[d.vehicle?.toLowerCase()] ?? [];
      return buildDispatchMessage(d, trips);
    }).join("\n\n" + "─".repeat(40) + "\n\n");
    navigator.clipboard.writeText(all).then(() => {
      setSentAll(true);
      setTimeout(() => setSentAll(false), 2500);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
              <Send size={16} className="text-violet-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 leading-none">Dispatch Messages</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                ML-generated route schedule · simulating{" "}
                <span className="font-mono font-bold text-violet-600">{toDisplay(currentMin)}</span>
                {savedAt && <span className="ml-2 text-slate-300">· ML run {new Date(savedAt).toLocaleTimeString()}</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {!hasML && (
            <div className="flex flex-col items-center py-8 text-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                <BrainCircuit size={30} className="text-slate-400" />
              </div>
              <p className="font-bold text-slate-700">No ML Allocation Found</p>
              <p className="text-sm text-slate-400 max-w-xs">
                Run the ML simulation on the <strong className="text-slate-600">AI Predictions</strong> page first.
              </p>
              {/* Diagnostic: show raw sessionStorage content */}
              <DiagPanel />
            </div>
          )}

          {hasML && driversWithBus.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-10">No drivers with assigned vehicles.</p>
          )}

          {/* ── Debug banner: shown when ML loaded but no vehicle matches ── */}
          {hasML && driversWithBus.length > 0 && Object.keys(vehicleMap).length > 0 &&
            driversWithBus.every(d => !vehicleMap[d.vehicle?.toLowerCase()]) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
              <p className="font-bold mb-1">⚠️ Vehicle ID mismatch detected</p>
              <p className="mb-1">ML plan has vehicles: <span className="font-mono">{Object.keys(vehicleMap).join(", ")}</span></p>
              <p>DB driver buses: <span className="font-mono">{driversWithBus.map(d=>d.vehicle).join(", ")}</span></p>
              <p className="mt-1 text-amber-600">Make sure bus codes in the DB match the ML vehicle IDs (e.g. "BUS-01").</p>
            </div>
          )}

          {hasML && driversWithBus.map((driver, idx) => {
            const key    = driver.vehicle?.toLowerCase();
            const trips  = vehicleMap[key] ?? [];
            const isExp  = expanded === driver.name;
            const curTrip = getCurrentTrip(trips, currentMin);
            const nxtTrip = !curTrip ? getNextTrip(trips, currentMin) : null;

            return (
              <div key={driver.name+idx} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                {/* Driver row */}
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <DriverAvatar name={driver.name} idx={idx} />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{driver.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold
                          px-2 py-0.5 rounded border
                          ${driver.vehicle?.startsWith("SHUTTLE")
                            ? "bg-violet-50 border-violet-200 text-violet-700"
                            : "bg-indigo-50 border-indigo-200 text-indigo-700"}`}>
                          {driver.vehicle?.startsWith("SHUTTLE") ? <Truck size={9}/> : <Bus size={9}/>}
                          {driver.vehicle}
                        </span>
                        {/* Live trip status at current simulated time */}
                        {curTrip ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                            On trip → {curTrip.to_hostel ?? curTrip.hostel}
                          </span>
                        ) : nxtTrip ? (
                          <span className="text-[11px] text-blue-600 font-medium">
                            Next at {nxtTrip.start_time}
                          </span>
                        ) : trips.length > 0 ? (
                          <span className="text-[11px] text-slate-400">All trips done</span>
                        ) : (
                          <span className="text-[11px] text-amber-600">Not in ML plan</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setExpanded(isExp ? null : driver.name)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border bg-white border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                      {isExp ? "Hide" : "Preview"}
                    </button>
                    <button onClick={() => copyMessage(driver, trips)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors
                        ${copied === driver.name
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"}`}>
                      {copied === driver.name ? <><Check size={12}/> Copied!</> : <><Copy size={12}/> Copy</>}
                    </button>
                  </div>
                </div>

                {/* Trip chips */}
                {trips.length > 0 && (
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                    {trips.map((t, ti) => {
                      const dep = toMin(t.start_time);
                      const arr = toMin(t.end_time ?? t.arrival_time);
                      const isActive = dep !== null && arr !== null && currentMin >= dep && currentMin < arr;
                      return (
                        <div key={ti}
                          className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border
                            ${isActive
                              ? "bg-emerald-100 border-emerald-300 text-emerald-800 font-bold"
                              : t.round === 2
                              ? "bg-amber-50 border-amber-200 text-amber-700"
                              : "bg-blue-50 border-blue-200 text-blue-700"}`}>
                          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>}
                          <Clock size={10}/>
                          <span className="font-mono font-bold">{t.start_time}</span>
                          <span className="opacity-50">→</span>
                          <span>{t.to_hostel ?? t.hostel}</span>
                          {t.round === 2 && <span className="font-bold opacity-60">R2</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Message preview */}
                {isExp && (
                  <div className="mx-4 mb-4 bg-white border border-slate-200 rounded-xl
                    p-4 text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                    {buildDispatchMessage(driver, trips)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {hasML && driversWithBus.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{driversWithBus.length}</span> drivers ·
                Copy individual messages above, or copy all at once.
              </p>
              <button onClick={copyAll}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-colors
                  ${sentAll ? "bg-emerald-500 text-white border-emerald-500" : "bg-violet-600 text-white border-violet-600 hover:bg-violet-700"}`}>
                {sentAll ? <><Check size={14}/> All Copied!</> : <><MessageSquare size={14}/> Copy All Messages</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function Drivers() {
  const [drivers,    setDrivers]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy,     setSortBy]     = useState("status");
  const [lastFetch,  setLastFetch]  = useState(null);

  // ── ML data as reactive state ───────────────────────────────────────────────
  // Polled every 5s so if the user runs ML on another tab / page, the button
  // updates automatically without needing a manual refresh.
  const [mlPhase1,  setMlPhase1]  = useState(null);
  const [mlPhase2,  setMlPhase2]  = useState(null);
  const [mlSavedAt, setMlSavedAt] = useState(null);

  // ── Test mode ──────────────────────────────────────────────────────────────
  const [testMode,    setTestMode]    = useState(false);
  const [testMinutes, setTestMinutes] = useState(8 * 60); // default 08:00
  const [, setTick]                  = useState(0);       // 30s live-clock tick

  // Modal states
  const [showAddModal,       setShowAddModal]       = useState(false);
  const [showBroadcastPanel, setShowBroadcastPanel] = useState(false);

  // ── Reactive ML loader ─────────────────────────────────────────────────────
  const reloadML = useCallback(() => {
    const result = readMLStorage();
    setMlPhase1(result?.phase1 ?? null);
    setMlPhase2(result?.phase2 ?? null);
    setMlSavedAt(result?.savedAt ?? null);
  }, []);

  // ── Fetch drivers ──────────────────────────────────────────────────────────
  const fetchDrivers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE}/admin/getDriverDetails`, {
        credentials:"include", headers:{"Content-Type":"application/json"},
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setDrivers(Array.isArray(data) ? data : []);
      setLastFetch(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
    reloadML();

    const driverTimer = setInterval(() => fetchDrivers(true), 30_000); // driver list
    const mlTimer     = setInterval(reloadML,                  5_000); // ML detection — fast poll
    const clockTimer  = setInterval(() => setTick(t => t+1),  30_000); // live clock tick
    return () => { clearInterval(driverTimer); clearInterval(mlTimer); clearInterval(clockTimer); };
  }, [fetchDrivers, reloadML]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const currentMin  = testMode ? testMinutes : nowMin();
  const hasML      = !!(mlPhase1?.first_round_assignments?.length);
  const vehicleMap = buildVehicleTripMap(mlPhase1, mlPhase2);

  const filtered = drivers.filter(d => {
    const t = searchTerm.toLowerCase();
    return !t || [d.name, d.phone, d.vehicle, d.status].some(v => v?.toLowerCase().includes(t));
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "status") {
      const sa = STATUS_ORDER[a.status?.toLowerCase()] ?? 99;
      const sb = STATUS_ORDER[b.status?.toLowerCase()] ?? 99;
      return sa !== sb ? sa - sb : (a.name ?? "").localeCompare(b.name ?? "");
    }
    if (sortBy === "vehicle") return (a.vehicle ?? "").localeCompare(b.vehicle ?? "");
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  const isEmpty = !loading && sorted.length === 0;
  const showTripCol = hasML; // only show "current trip" column when ML data exists

  return (
    <div className="min-h-screen bg-[#f4f6fb] p-5 md:p-8">
      <AdminNavbar />

      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Drivers</h1>
          <p className="text-slate-500 text-sm mt-1">
            {loading ? "Fetching…" : `${drivers.length} driver${drivers.length !== 1 ? "s" : ""} registered`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Live / test clock */}
          <div className={`flex items-center gap-1.5 text-sm font-mono px-3 py-2 rounded-xl border
            ${testMode ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-white border-slate-200 text-slate-600"}`}>
            {testMode
              ? <FlaskConical size={13} className="text-amber-500"/>
              : <Radio size={13} className="text-emerald-500 animate-pulse"/>}
            {toDisplay(currentMin)}
          </div>

          {lastFetch && !loading && (
            <span className="hidden lg:block text-xs text-slate-400">
              Updated {lastFetch.toLocaleTimeString()}
            </span>
          )}

          {/* Test mode toggle */}
          <button onClick={() => setTestMode(t => !t)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors
              ${testMode
                ? "bg-amber-100 border-amber-300 text-amber-700"
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
            <FlaskConical size={13}/>
            {testMode ? "Exit Test" : "Test Mode"}
          </button>

          {/* Refresh */}
          <button onClick={() => fetchDrivers()} disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500
              hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-50
              rounded-xl px-3 py-2 transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""}/>
            Refresh
          </button>

          {/* Dispatch */}
          <button onClick={() => setShowBroadcastPanel(true)}
            className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl border transition-colors
              ${hasML
                ? "bg-violet-600 hover:bg-violet-700 text-white border-violet-600 shadow-sm shadow-violet-200"
                : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"}`}>
            <Send size={14}/>
            {hasML ? "Send Dispatch" : "Dispatch"}
          </button>

          {/* Add Driver */}
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl
              bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600
              shadow-sm shadow-indigo-200 transition-colors">
            <Plus size={14}/>
            Add Driver
          </button>
        </div>
      </div>

      {/* ── Test mode slider ─────────────────────────────────────────── */}
      {testMode && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <FlaskConical size={14} className="text-amber-600"/>
            <span className="text-sm font-bold text-amber-800">Test Mode</span>
            <span className="text-xs text-amber-600">— simulating time:</span>
            <span className="font-mono text-sm font-black text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-lg border border-amber-200">
              {toDisplay(testMinutes)}
            </span>
            {hasML
              ? <span className="text-[11px] text-amber-500 ml-auto hidden md:block">
                  Trip column updates as you drag · shows driver activity at simulated time
                </span>
              : <span className="text-[11px] text-amber-400 ml-auto hidden md:block">
                  Run ML simulation to see per-driver trip data
                </span>}
          </div>
          <input type="range" min={0} max={23*60+59} step={1} value={testMinutes}
            onChange={e => setTestMinutes(Number(e.target.value))}
            className="w-full accent-amber-500 mb-1.5"/>
          <div className="flex justify-between text-[10px] text-amber-400 font-mono mb-3">
            {["00:00","04:00","08:00","12:00","16:00","20:00","23:59"].map(t => <span key={t}>{t}</span>)}
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-xs text-amber-700 font-bold mr-1">Jump to:</span>
            {QUICK_TIMES.map(t => (
              <button key={t} onClick={() => setTestMinutes(toMin(t))}
                className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-lg border transition-colors
                  ${testMinutes === toMin(t)
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-white border-amber-200 text-amber-700 hover:bg-amber-100"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Stat chips ───────────────────────────────────────────────── */}
      {!loading && drivers.length > 0 && (
        <div className="mb-5"><StatChips drivers={drivers}/></div>
      )}

      {/* ── Search + Sort ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          <input placeholder="Search by name, phone, vehicle…" value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl
              focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-400 transition"/>
        </div>
        <div className="relative">
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="appearance-none bg-white border border-slate-200 text-slate-600 text-xs font-semibold
              pl-3 pr-7 py-2.5 rounded-xl cursor-pointer focus:outline-none focus:ring-2
              focus:ring-indigo-200 hover:border-slate-300 transition-colors">
            <option value="status">Sort by Status</option>
            <option value="name">Sort by Name</option>
            <option value="vehicle">Sort by Vehicle</option>
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────── */}
      {error && (
        <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0"/>
          <span>Failed to load: <span className="font-semibold">{error}</span></span>
          <button onClick={() => fetchDrivers()} className="ml-auto text-xs font-bold underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          DESKTOP TABLE
          ════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {["Driver", "Phone", "Bus", "Status", ...(showTripCol ? ["Current Trip"] : [])].map(h => (
                <th key={h} className="px-6 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {h}
                  {h === "Current Trip" && (
                    <span className={`ml-1.5 text-[10px] font-normal lowercase tracking-normal
                      ${testMode ? "text-amber-500" : "text-slate-400"}`}>
                      @ {toDisplay(currentMin)}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              [...Array(5)].map((_,i) => (
                <tr key={i}>
                  {[140,96,80,64,120].slice(0, showTripCol ? 5 : 4).map((w,j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded-full animate-pulse" style={{width:w}}/>
                    </td>
                  ))}
                </tr>
              ))
            ) : isEmpty ? (
              <tr>
                <td colSpan={showTripCol ? 5 : 4} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <User size={36} className="opacity-20"/>
                    <p className="font-semibold text-slate-500">
                      {searchTerm ? `No drivers match "${searchTerm}"` : "No drivers registered yet"}
                    </p>
                    {searchTerm
                      ? <button onClick={() => setSearchTerm("")} className="text-xs text-indigo-500 hover:underline">Clear search</button>
                      : <button onClick={() => setShowAddModal(true)} className="text-xs text-indigo-500 hover:underline mt-1">Add the first driver →</button>}
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((d, idx) => {
                const cfg   = getStatusCfg(d.status);
                const trips = vehicleMap[d.vehicle?.toLowerCase()] ?? [];
                return (
                  <tr key={`${d.name}-${idx}`} className={`transition-colors duration-100 ${cfg.row}`}>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <DriverAvatar name={d.name} idx={idx}/>
                        <div>
                          <p className="font-bold text-slate-800 text-sm leading-snug">{d.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{d.vehicle ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Phone size={13} className="text-slate-400 shrink-0"/>
                        {d.phone || <span className="text-slate-400 italic text-xs">N/A</span>}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      {d.vehicle ? (
                        <div className="inline-flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-full text-sm text-slate-700 font-mono font-semibold">
                          {d.vehicle.startsWith("SHUTTLE") ? <Truck size={11} className="text-slate-500"/> : <Bus size={11} className="text-slate-500"/>}
                          {d.vehicle}
                        </div>
                      ) : <span className="text-xs italic text-slate-400">Unassigned</span>}
                    </td>
                    <td className="px-6 py-3.5"><StatusBadge status={d.status}/></td>
                    {showTripCol && (
                      <td className="px-6 py-3.5">
                        <TripPill trips={trips} currentMin={currentMin}/>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {!loading && sorted.length > 0 && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
            <span>
              Showing <span className="font-semibold text-slate-600">{sorted.length}</span>
              {searchTerm ? ` of ${drivers.length}` : ""} drivers
            </span>
            <span>Auto-refreshes every 30s</span>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          MOBILE CARDS
          ════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden space-y-3">
        {loading ? (
          [...Array(4)].map((_,i) => (
            <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200 animate-pulse"/>
          ))
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
            <User size={36} className="opacity-20"/>
            <p className="font-semibold text-slate-500">
              {searchTerm ? `No results for "${searchTerm}"` : "No drivers registered yet"}
            </p>
            {!searchTerm && (
              <button onClick={() => setShowAddModal(true)} className="text-xs text-indigo-500 hover:underline mt-1">Add the first driver →</button>
            )}
          </div>
        ) : (
          sorted.map((d, idx) => {
            const cfg   = getStatusCfg(d.status);
            const trips = vehicleMap[d.vehicle?.toLowerCase()] ?? [];
            return (
              <div key={`${d.name}-${idx}`}
                className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${cfg.border} px-4 py-3.5 shadow-sm`}>
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3">
                    <DriverAvatar name={d.name} idx={idx}/>
                    <div>
                      <p className="font-bold text-slate-800 text-sm leading-tight">{d.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{d.vehicle ?? "No bus assigned"}</p>
                    </div>
                  </div>
                  <StatusBadge status={d.status}/>
                </div>
                <div className="flex flex-col gap-2 pt-2.5 border-t border-slate-100">
                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Phone size={12} className="text-slate-400"/>
                      {d.phone || <span className="italic text-slate-400">No phone</span>}
                    </div>
                    {d.vehicle && (
                      <div className="flex items-center gap-1.5">
                        {d.vehicle.startsWith("SHUTTLE") ? <Truck size={11} className="text-slate-400"/> : <Bus size={11} className="text-slate-400"/>}
                        <span className="font-mono font-semibold">{d.vehicle}</span>
                      </div>
                    )}
                  </div>
                  {/* Trip pill on mobile */}
                  {showTripCol && trips.length > 0 && (
                    <div className="mt-0.5">
                      <TripPill trips={trips} currentMin={currentMin}/>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        {!loading && sorted.length > 0 && (
          <p className="text-center text-xs text-slate-400 pt-2">
            {sorted.length} drivers · auto-refreshes every 30s
          </p>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {showAddModal && (
        <AddDriverModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => fetchDrivers()}
        />
      )}

      {showBroadcastPanel && (
        <BroadcastPanel
          drivers={drivers}
          phase1={mlPhase1}
          phase2={mlPhase2}
          savedAt={mlSavedAt}
          currentMin={currentMin}
          onClose={() => setShowBroadcastPanel(false)}
        />
      )}
    </div>
  );
}