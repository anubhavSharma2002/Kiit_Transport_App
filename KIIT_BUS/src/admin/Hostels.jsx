import { useEffect, useState, useCallback } from "react";
import {
  Bus, CheckCircle2, Clock, RefreshCw, BrainCircuit,
  AlertTriangle, Radio, FlaskConical, Users, Truck,
  ChevronDown, ChevronUp, ArrowRight,
} from "lucide-react";
import AdminNavbar from "../components/AdminNavbar";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const ML_STORAGE_KEY = "kiit_ml_allocation";

// Quick-jump times for test mode (class start hours from ML data)
const QUICK_JUMP_TIMES = [
  "07:00","08:00","09:00","10:00","11:00",
  "12:00","13:00","14:00","15:00","16:00",
];

// ─────────────────────────────────────────────────────────────────────────────
// TIME HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const toMin     = t => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toDisplay = m  => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const nowMin    = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

// ─────────────────────────────────────────────────────────────────────────────
// ML DATA EXTRACTION
//
// sessionStorage["kiit_ml_allocation"] is written by MLPredictions.jsx as:
//   { result: { phase1, phase2, bus_timetable }, savedAt }
//
// phase1 shape (from phase1_first_round.py):
//   first_round_assignments[]  → { vehicle_id, vehicle_type, hostel, time_slot,
//                                   start_time, end_time, students_assigned, ... }
//   hostel_first_round_summary[] → { hostel, time_slot, predicted_students,
//                                     served_in_first_round, remaining_after_first_round }
//   vehicle_state_after_round_1[] → { vehicle_id, vehicle_type, time_slot,
//                                      available_from_time, can_do_second_round }
//
// phase2 shape (from phase2_reassignment.py):
//   second_round_assignments[]  → { vehicle_id, vehicle_type, to_hostel, time_slot,
//                                    start_time, arrival_time, students_assigned, ... }
//   hostel_second_round_summary[] → { hostel, time_slot, predicted_students,
//                                      total_served, remaining_students }
//
// KEY RULE from phase1_first_round.py lines 41-43:
//   time_slot  = "HH:00"           ← CLASS start hour  (what user wants shown as demand time)
//   start_time = class_hour − 30min ← vehicle departure time (shown as secondary info only)
//   end_time   = start_time + 20min ← vehicle arrival at campus
//
// So for each hostel × time_slot we build a slot record with:
//   classHour     → time_slot  ("08:00") — PRIMARY label shown in UI
//   departureTime → start_time  ("07:30") — shown in parens as secondary
//   arrivalTime   → end_time    ("07:50")
//   predicted, p1Served, p2Served, totalServed, remaining
//   p1Vehicles [{id,type}], p2Vehicles [{id,type}]  (round 2 marked with badge)
//
// Slot status at a given clock time:
//   "upcoming" → now  < departureTime
//   "active"   → departureTime ≤ now < arrivalTime  (buses currently running)
//   "done"     → now ≥ arrivalTime
// ─────────────────────────────────────────────────────────────────────────────
function buildHostelData(raw) {
  // raw = whatever is stored in sessionStorage
  // Support both shapes: { result: { phase1, phase2 } } and { phase1, phase2 }
  const mlData = raw?.result ?? raw;
  if (!mlData?.phase1) return [];

  const p1Sum   = mlData.phase1.hostel_first_round_summary   ?? [];
  const p1Asgn  = mlData.phase1.first_round_assignments      ?? [];
  const p2Sum   = mlData.phase2?.hostel_second_round_summary ?? [];
  const p2Asgn  = mlData.phase2?.second_round_assignments    ?? [];

  // ── Step 1: seed slots from phase1 summary ─────────────────────────────────
  // hostelMap[hostelName][time_slot] = slot record
  const hostelMap = {};

  for (const item of p1Sum) {
    if (!hostelMap[item.hostel]) hostelMap[item.hostel] = {};
    hostelMap[item.hostel][item.time_slot] = {
      classHour:     item.time_slot,              // "HH:00" — shown as demand hour
      predicted:     item.predicted_students,
      p1Served:      item.served_in_first_round,
      p2Served:      0,                           // filled below from p2 summary
      totalServed:   item.served_in_first_round,
      remaining:     item.remaining_after_first_round,
      p1Vehicles:    [],                          // [{id, type}]
      p2Vehicles:    [],                          // [{id, type}] — round 2 redeployments
      departureTime: null,                        // from p1 assignment.start_time
      arrivalTime:   null,                        // from p1 assignment.end_time
    };
  }

  // ── Step 2: enrich timing + vehicles from phase1 assignments ───────────────
  for (const a of p1Asgn) {
    const slot = hostelMap[a.hostel]?.[a.time_slot];
    if (!slot) continue;
    if (!slot.departureTime) slot.departureTime = a.start_time;
    if (!slot.arrivalTime)   slot.arrivalTime   = a.end_time;
    if (!slot.p1Vehicles.find(v => v.id === a.vehicle_id))
      slot.p1Vehicles.push({ id: a.vehicle_id, type: a.vehicle_type ?? "Bus" });
  }

  // ── Step 3: enrich vehicles from phase2 assignments ────────────────────────
  // Note: phase2 uses `to_hostel` (not `hostel`) and `arrival_time` (not `end_time`)
  for (const a of p2Asgn) {
    const slot = hostelMap[a.to_hostel]?.[a.time_slot];
    if (!slot) continue;
    if (!slot.p2Vehicles.find(v => v.id === a.vehicle_id))
      slot.p2Vehicles.push({ id: a.vehicle_id, type: a.vehicle_type ?? "Bus" });
  }

  // ── Step 4: override totals with authoritative phase2 summary numbers ───────
  for (const item of p2Sum) {
    const slot = hostelMap[item.hostel]?.[item.time_slot];
    if (!slot) continue;
    slot.totalServed = item.total_served;
    slot.remaining   = item.remaining_students;
    slot.p2Served    = item.total_served - slot.p1Served;
    if (slot.p2Served < 0) slot.p2Served = 0;
  }

  // ── Step 5: flatten to sorted array ────────────────────────────────────────
  return Object.entries(hostelMap)
    .map(([hostel, slots]) => {
      const slotList = Object.values(slots)
        .sort((a, b) => a.classHour.localeCompare(b.classHour));
      return {
        hostel,
        slotList,
        totalPredicted: slotList.reduce((s, x) => s + x.predicted,  0),
        totalServed:    slotList.reduce((s, x) => s + x.totalServed, 0),
        totalRemaining: slotList.reduce((s, x) => s + x.remaining,   0),
      };
    })
    .sort((a, b) => a.hostel.localeCompare(b.hostel));
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT STATUS LOGIC
// ─────────────────────────────────────────────────────────────────────────────
function getSlotStatus(slot, currentMin) {
  const dep = toMin(slot.departureTime);
  const arr = toMin(slot.arrivalTime);
  if (dep === null) return "pending";
  if (currentMin < dep)                            return "upcoming";
  if (arr === null || currentMin < arr)            return "active";   // buses in motion
  return "done";
}

// Pick the most relevant slot for the hostel header summary
function getFocusSlot(slotList, currentMin) {
  if (!slotList?.length) return null;
  const active = slotList.find(s => getSlotStatus(s, currentMin) === "active");
  if (active) return { ...active, status: "active" };
  const upcoming = [...slotList]
    .filter(s => getSlotStatus(s, currentMin) === "upcoming")
    .sort((a, b) => toMin(a.departureTime) - toMin(b.departureTime));
  if (upcoming.length) return { ...upcoming[0], status: "upcoming" };
  const done = [...slotList]
    .filter(s => getSlotStatus(s, currentMin) === "done")
    .sort((a, b) => toMin(b.departureTime) - toMin(a.departureTime));
  if (done.length) return { ...done[0], status: "done" };
  return { ...slotList[0], status: "pending" };
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL ATOMS
// ─────────────────────────────────────────────────────────────────────────────

// Thin horizontal fill bar
function FillBar({ served, predicted, status }) {
  const pct = predicted > 0 ? Math.min(100, Math.round((served / predicted) * 100)) : 0;
  const color =
    status === "active" && pct >= 100 ? "bg-emerald-400" :
    status === "active" && pct >= 60  ? "bg-indigo-400"  :
    status === "active"               ? "bg-amber-400"   :
    status === "upcoming"             ? "bg-blue-300"    :
                                        "bg-slate-300";
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// Vehicle pill — bus (indigo) or shuttle (violet); round-2 gets amber badge
function VehiclePill({ id, type, round }) {
  const isShuttle = type === "Shuttle";
  return (
    <span className={`relative inline-flex items-center gap-1 text-[11px] font-mono font-bold
      px-2 py-0.5 rounded-md border select-none
      ${isShuttle
        ? "bg-violet-50 border-violet-200 text-violet-700"
        : "bg-indigo-50 border-indigo-200 text-indigo-700"}`}>
      {isShuttle ? <Truck size={9} /> : <Bus size={9} />}
      {id}
      {round === 2 && (
        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-amber-400 text-white
          text-[8px] font-black rounded-full flex items-center justify-center leading-none border border-white">
          2
        </span>
      )}
    </span>
  );
}

// Status badge used in card header
const STATUS_BADGE = {
  active:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  upcoming: "bg-blue-100 text-blue-700 border-blue-200",
  done:     "bg-slate-100 text-slate-500 border-slate-200",
  pending:  "bg-slate-100 text-slate-400 border-slate-100",
};
const STATUS_LABEL = { active: "Live", upcoming: "Upcoming", done: "Done", pending: "Pending" };

function StatusBadge({ status }) {
  return (
    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border
      uppercase tracking-widest ${STATUS_BADGE[status] ?? STATUS_BADGE.pending}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT ROW
// One horizontal row per class hour inside the hostel card.
// Shows: class hour (bold) · demand · served · buses · fill bar · vehicle pills
// ─────────────────────────────────────────────────────────────────────────────
function SlotRow({ slot, currentMin }) {
  const status    = getSlotStatus(slot, currentMin);
  const isActive  = status === "active";
  const isUpcoming = status === "upcoming";
  const servedPct = slot.predicted > 0
    ? Math.round((slot.totalServed / slot.predicted) * 100) : 0;

  // Deduplicate: p1 vehicles + p2-only vehicles
  const p1Ids  = new Set(slot.p1Vehicles.map(v => v.id));
  const p2Only = slot.p2Vehicles.filter(v => !p1Ids.has(v.id));
  const totalVehicleCount = p1Ids.size + p2Only.length;

  const rowBg =
    isActive   ? "bg-emerald-50/70 border-emerald-200" :
    isUpcoming ? "bg-blue-50/50 border-blue-100"       :
                 "bg-slate-50/50 border-slate-100";

  return (
    <div className={`rounded-xl border px-4 py-3 transition-colors duration-200 ${rowBg}`}>

      {/* ── Row header: class hour + waiting indicator ──────── */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          )}

          {/* CLASS HOUR — this is the demand time the user wants to see */}
          <span className={`font-mono font-black text-sm tracking-tight
            ${isActive ? "text-emerald-700" : isUpcoming ? "text-blue-700" : "text-slate-500"}`}>
            {slot.classHour}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">class</span>

          {/* Departure/arrival shown as secondary context only */}
          {slot.departureTime && (
            <span className="hidden sm:inline text-[10px] font-mono bg-white border border-slate-200
              text-slate-400 px-1.5 py-0.5 rounded">
              dep {slot.departureTime}
            </span>
          )}
          {slot.arrivalTime && (
            <span className="hidden sm:inline text-[10px] font-mono bg-white border border-slate-200
              text-slate-400 px-1.5 py-0.5 rounded">
              arr {slot.arrivalTime}
            </span>
          )}
        </div>

        {/* Waiting / served indicator */}
        <span className={`text-xs font-bold shrink-0
          ${slot.remaining === 0 ? "text-emerald-600" : "text-red-500"}`}>
          {slot.remaining === 0
            ? "✓ all served"
            : `${slot.remaining} waiting`}
        </span>
      </div>

      {/* ── Stats grid: Demand / Served / Vehicles ────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-2.5">
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Demand</p>
          <p className="text-base font-black text-slate-700">{slot.predicted}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Served</p>
          <p className={`text-base font-black
            ${servedPct >= 100 ? "text-emerald-600" : "text-indigo-700"}`}>
            {slot.totalServed}
            <span className="text-[10px] font-normal text-slate-400 ml-0.5">
              ({servedPct}%)
            </span>
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Vehicles</p>
          <p className="text-base font-black text-slate-700">{totalVehicleCount}</p>
        </div>
      </div>

      {/* ── Serve fill bar ─────────────────────────────────────── */}
      <FillBar served={slot.totalServed} predicted={slot.predicted} status={status} />

      {/* ── R1 + R2 contribution breakdown ────────────────────── */}
      {slot.p2Served > 0 && (
        <p className="text-[10px] text-slate-400 mt-1">
          R1: <span className="font-semibold text-indigo-600">{slot.p1Served}</span>
          {"  +  "}
          R2: <span className="font-semibold text-amber-600">{slot.p2Served}</span>
        </p>
      )}

      {/* ── All vehicles allocated to this slot ───────────────── */}
      {(slot.p1Vehicles.length > 0 || p2Only.length > 0) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
          {slot.p1Vehicles.map(v => (
            <VehiclePill key={`p1-${v.id}`} id={v.id} type={v.type} round={1} />
          ))}
          {p2Only.map(v => (
            <VehiclePill key={`p2-${v.id}`} id={v.id} type={v.type} round={2} />
          ))}
          <span className="text-[10px] text-slate-400 flex items-center gap-0.5 ml-1">
            <ArrowRight size={9} /> Campus 25
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOSTEL CARD
// Header = hostel name + current status + aggregate stats + overall fill bar
// Body   = one SlotRow per class hour (all slots, sorted by time)
// ─────────────────────────────────────────────────────────────────────────────
function HostelCard({ hostelData, currentMin }) {
  const [expanded, setExpanded] = useState(true);

  const focus        = getFocusSlot(hostelData.slotList, currentMin);
  const focusStatus  = focus?.status ?? "pending";
  const activeSlot   = hostelData.slotList.find(s => getSlotStatus(s, currentMin) === "active");

  // Card left-border accent
  const accentBorder = {
    active:   "border-l-emerald-400",
    upcoming: "border-l-blue-400",
    done:     "border-l-slate-300",
    pending:  "border-l-slate-200",
  }[focusStatus];

  // Header gradient tint
  const headerGrad = {
    active:   "from-emerald-50/80 to-white",
    upcoming: "from-blue-50/60 to-white",
    done:     "from-slate-50 to-white",
    pending:  "from-slate-50 to-white",
  }[focusStatus];

  // All unique vehicle IDs across every slot of this hostel
  const allVehicleIds = new Set(
    hostelData.slotList.flatMap(s =>
      [...s.p1Vehicles, ...s.p2Vehicles].map(v => v.id)
    )
  );

  const overallPct = hostelData.totalPredicted > 0
    ? Math.round((hostelData.totalServed / hostelData.totalPredicted) * 100)
    : 0;

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${accentBorder}
      shadow-sm hover:shadow-lg transition-shadow duration-200 overflow-hidden`}>

      {/* ── Card header (click to collapse) ─────────────────────── */}
      <div
        className={`bg-gradient-to-r ${headerGrad} px-5 pt-4 pb-3 cursor-pointer select-none`}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between gap-3">

          {/* Left: hostel name + live status line */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h3 className="text-[17px] font-black text-slate-800 tracking-tight leading-none">
                {hostelData.hostel}
              </h3>
              <StatusBadge status={focusStatus} />
              {focusStatus === "active" && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                  <Radio size={9} className="animate-pulse" /> LIVE
                </span>
              )}
            </div>

            {/* Active slot summary line */}
            {activeSlot ? (
              <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500">
                <Clock size={11} className="text-slate-400" />
                <span>
                  Class at{" "}
                  <span className="font-mono font-bold text-emerald-700">
                    {activeSlot.classHour}
                  </span>
                </span>
                <span className="text-slate-300">·</span>
                <span>
                  <span className="font-bold text-slate-700">{activeSlot.totalServed}</span>
                  /{activeSlot.predicted} served
                </span>
                {activeSlot.remaining > 0 && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="font-bold text-red-500">
                      {activeSlot.remaining} waiting
                    </span>
                  </>
                )}
                <span className="text-slate-300">·</span>
                <Bus size={11} className="text-slate-400" />
                <span>
                  {new Set([
                    ...activeSlot.p1Vehicles,
                    ...activeSlot.p2Vehicles,
                  ].map(v => v.id)).size} buses
                </span>
              </div>
            ) : focusStatus === "upcoming" && focus ? (
              <p className="text-xs text-slate-400">
                Next class at{" "}
                <span className="font-mono font-bold text-blue-600">{focus.classHour}</span>
                {focus.departureTime && (
                  <span> — buses depart {focus.departureTime}</span>
                )}
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                {hostelData.slotList.length} slot
                {hostelData.slotList.length !== 1 ? "s" : ""} today · all complete
              </p>
            )}
          </div>

          {/* Right: aggregate stats + chevron */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex gap-3 text-right">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-none mb-0.5">
                  Demand
                </p>
                <p className="text-lg font-black text-slate-700 leading-none">
                  {hostelData.totalPredicted}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-none mb-0.5">
                  Served
                </p>
                <p className={`text-lg font-black leading-none
                  ${overallPct >= 100 ? "text-emerald-600" : "text-indigo-600"}`}>
                  {overallPct}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-none mb-0.5">
                  Buses
                </p>
                <p className="text-lg font-black text-slate-700 leading-none">
                  {allVehicleIds.size}
                </p>
              </div>
            </div>
            <span className="text-slate-400">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </div>
        </div>

        {/* Overall fill bar */}
        <div className="mt-3">
          <FillBar
            served={hostelData.totalServed}
            predicted={hostelData.totalPredicted}
            status={focusStatus}
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
            <span>{hostelData.totalServed} served</span>
            <span>
              {hostelData.totalRemaining > 0
                ? `${hostelData.totalRemaining} still waiting`
                : "fully served ✓"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Slot rows (one per class hour) ──────────────────────── */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-2">
          {hostelData.slotList.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No slot data</p>
          ) : (
            hostelData.slotList.map(slot => (
              <SlotRow
                key={slot.classHour}
                slot={slot}
                currentMin={currentMin}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-28 text-center px-4">
      <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-5 shadow-inner">
        <BrainCircuit size={36} className="text-slate-400" />
      </div>
      <h3 className="text-xl font-bold text-slate-700 mb-2">No Allocation Data</h3>
      <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
        Run the ML simulation from the{" "}
        <strong className="text-slate-600">AI Predictions</strong> page.
        Hostel demand, bus assignments and serve rates will populate here automatically.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function Hostels() {
  const [rawData,     setRawData]     = useState(null);   // raw sessionStorage value
  const [loading,     setLoading]     = useState(true);
  const [savedAt,     setSavedAt]     = useState(null);
  const [testMode,    setTestMode]    = useState(false);
  const [testMinutes, setTestMinutes] = useState(8 * 60); // default 08:00
  const [,            setTick]        = useState(0);      // forces 30s re-render

  // ── Load from sessionStorage ──────────────────────────────────────────────
  // MLPredictions.jsx stores: sessionStorage.setItem("kiit_ml_allocation", JSON.stringify({
  //   result: { phase1, phase2, bus_timetable },
  //   savedAt: Date.now()
  // }))
  const loadMLData = useCallback(() => {
    setLoading(true);
    try {
      const raw = sessionStorage.getItem(ML_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setRawData(parsed);
        setSavedAt(parsed.savedAt ?? null);
      } else {
        setRawData(null);
      }
    } catch {
      setRawData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMLData();
    const dataId  = setInterval(loadMLData,               60_000); // re-check session each min
    const clockId = setInterval(() => setTick(t => t + 1), 30_000); // live clock tick
    return () => { clearInterval(dataId); clearInterval(clockId); };
  }, [loadMLData]);

  // ── Derive all display data ───────────────────────────────────────────────
  const currentMin   = testMode ? testMinutes : nowMin();
  const hostelData   = buildHostelData(rawData);

  const totalPredicted = hostelData.reduce((s, h) => s + h.totalPredicted, 0);
  const totalServed    = hostelData.reduce((s, h) => s + h.totalServed,    0);
  const totalWaiting   = hostelData.reduce((s, h) => s + h.totalRemaining, 0);
  const activeCount    = hostelData.filter(h =>
    h.slotList.some(s => getSlotStatus(s, currentMin) === "active")
  ).length;

  // Unique class hours for the hour filter
  const allClassHours = [...new Set(
    hostelData.flatMap(h => h.slotList.map(s => s.classHour))
  )].sort();

  const [filterHour, setFilterHour] = useState("all");

  // Sort: active first → upcoming → done; ties by remaining desc
  const PRIORITY = { active: 0, upcoming: 1, done: 2, pending: 3 };
  const sortedHostels = [...hostelData].sort((a, b) => {
    const fa = getFocusSlot(a.slotList, currentMin);
    const fb = getFocusSlot(b.slotList, currentMin);
    const pa = PRIORITY[fa?.status ?? "pending"] ?? 3;
    const pb = PRIORITY[fb?.status ?? "pending"] ?? 3;
    if (pa !== pb) return pa - pb;
    return b.totalRemaining - a.totalRemaining;
  });

  const filteredHostels = filterHour === "all"
    ? sortedHostels
    : sortedHostels.filter(h => h.slotList.some(s => s.classHour === filterHour));

  return (
    <div className="min-h-screen bg-[#f4f6fb] p-5 md:p-8">
      <AdminNavbar />

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Hostel Demand</h1>
          <p className="text-slate-500 text-sm mt-1">
            {hostelData.length > 0
              ? `${hostelData.length} hostels · real-time ML allocation`
              : "Waiting for ML simulation data"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Live / test clock badge */}
          <div className={`flex items-center gap-1.5 text-sm font-mono px-3 py-2 rounded-xl border
            ${testMode
              ? "bg-amber-50 border-amber-300 text-amber-700"
              : "bg-white border-slate-200 text-slate-600"}`}>
            {testMode
              ? <FlaskConical size={13} className="text-amber-500" />
              : <Radio size={13} className="text-emerald-500 animate-pulse" />}
            {toDisplay(currentMin)}
          </div>

          {savedAt && (
            <span className="hidden md:block text-xs text-slate-400">
              ML run {new Date(savedAt).toLocaleTimeString()}
            </span>
          )}

          {/* Test mode toggle */}
          <button
            onClick={() => setTestMode(t => !t)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors
              ${testMode
                ? "bg-amber-100 border-amber-300 text-amber-700"
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
            <FlaskConical size={13} />
            {testMode ? "Exit Test" : "Test Mode"}
          </button>

          {/* Refresh */}
          <button
            onClick={() => { loadMLData(); setTick(t => t + 1); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500
              hover:text-slate-700 border border-slate-200 bg-white hover:bg-slate-50
              rounded-xl px-3 py-2 transition-colors">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Test mode slider ─────────────────────────────────────────── */}
      {testMode && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <FlaskConical size={14} className="text-amber-600" />
            <span className="text-sm font-bold text-amber-800">Test Mode</span>
            <span className="text-xs text-amber-600">— simulating time:</span>
            <span className="font-mono text-sm font-black text-amber-700 bg-amber-100
              px-2.5 py-0.5 rounded-lg border border-amber-200">
              {toDisplay(testMinutes)}
            </span>
            <span className="text-[11px] text-amber-500 ml-auto hidden md:block">
              Drag slider · all cards update instantly
            </span>
          </div>

          <input
            type="range" min={0} max={23 * 60 + 59} step={1} value={testMinutes}
            onChange={e => setTestMinutes(Number(e.target.value))}
            className="w-full accent-amber-500 mb-1.5"
          />
          <div className="flex justify-between text-[10px] text-amber-400 font-mono mb-3">
            {["00:00","04:00","08:00","12:00","16:00","20:00","23:59"].map(t => (
              <span key={t}>{t}</span>
            ))}
          </div>

          {/* Quick-jump to class start hours */}
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-xs text-amber-700 font-bold mr-1">Jump to:</span>
            {QUICK_JUMP_TIMES.map(t => (
              <button
                key={t}
                onClick={() => setTestMinutes(toMin(t))}
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

      {/* ── Summary stats ────────────────────────────────────────────── */}
      {hostelData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: "Active Now",   value: activeCount,    icon: Radio,
              color: "text-emerald-700", iconCls: "text-emerald-500 animate-pulse",
              bg: "bg-emerald-50 border-emerald-100",
            },
            {
              label: "Total Demand", value: totalPredicted, icon: Users,
              color: "text-slate-800",   iconCls: "text-slate-400",
              bg: "bg-white border-slate-200",
            },
            {
              label: "Served",       value: totalServed,    icon: CheckCircle2,
              color: "text-indigo-700", iconCls: "text-indigo-400",
              bg: "bg-indigo-50 border-indigo-100",
            },
            {
              label: "Waiting",      value: totalWaiting,   icon: AlertTriangle,
              color: totalWaiting > 0 ? "text-red-700" : "text-emerald-700",
              iconCls: totalWaiting > 0 ? "text-red-400" : "text-emerald-400",
              bg: totalWaiting > 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100",
            },
          ].map(({ label, value, icon: Icon, color, iconCls, bg }) => (
            <div key={label} className={`${bg} border rounded-2xl px-5 py-4 flex items-center gap-3`}>
              <Icon size={18} className={`${iconCls} shrink-0`} />
              <div>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">
                  {label}
                </p>
                <p className={`text-2xl font-black ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Hour filter ──────────────────────────────────────────────── */}
      {allClassHours.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <span className="text-xs font-bold text-slate-500 mr-1">Filter by class hour:</span>
          <button
            onClick={() => setFilterHour("all")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors
              ${filterHour === "all"
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
            All
          </button>
          {allClassHours.map(h => (
            <button
              key={h}
              onClick={() => setFilterHour(h)}
              className={`text-xs font-mono font-semibold px-3 py-1.5 rounded-xl border transition-colors
                ${filterHour === h
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200"}`}>
              {h}
            </button>
          ))}
        </div>
      )}

      {/* ── Main grid ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 h-56 animate-pulse" />
          ))}
        </div>
      ) : hostelData.length === 0 ? (
        <EmptyState />
      ) : filteredHostels.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-500 font-medium">
            No hostels have class at{" "}
            <span className="font-mono font-bold">{filterHour}</span>
          </p>
          <button
            onClick={() => setFilterHour("all")}
            className="mt-2 text-xs text-indigo-500 hover:underline">
            Clear filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredHostels.map(h => (
            <HostelCard key={h.hostel} hostelData={h} currentMin={currentMin} />
          ))}
        </div>
      )}

      {/* ── Legend ───────────────────────────────────────────────────── */}
      {hostelData.length > 0 && (
        <div className="mt-10 pt-6 border-t border-slate-200 flex flex-wrap items-center
          gap-4 text-[11px] text-slate-400">
          <span className="font-bold text-slate-500">Legend:</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-0.5 font-mono text-[11px]
              bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded">
              <Bus size={9} /> BUS-01
            </span>
            Round 1 Bus
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-0.5 font-mono text-[11px]
              bg-violet-50 border border-violet-200 text-violet-700 px-1.5 py-0.5 rounded">
              <Truck size={9} /> SHUTTLE-01
            </span>
            Round 1 Shuttle
          </span>
          <span className="flex items-center gap-1.5">
            <span className="relative inline-flex items-center gap-0.5 font-mono text-[11px]
              bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded">
              <Bus size={9} /> BUS-02
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-amber-400 text-white
                text-[8px] font-black rounded-full flex items-center justify-center border border-white">
                2
              </span>
            </span>
            Round 2 redeployment
          </span>
          <span className="flex items-center gap-1.5 ml-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active trip window
          </span>
          <span className="ml-2 italic">
            Class hour = demand time shown · dep/arr = actual bus schedule (30 min before class)
          </span>
        </div>
      )}
    </div>
  );
}