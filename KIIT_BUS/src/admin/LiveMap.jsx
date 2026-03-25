import { useEffect, useRef, useState, useCallback } from "react";
import {
  Bus, Navigation, RefreshCw, Radio,
  Wrench, Clock, AlertTriangle, CheckCircle2, Zap,
} from "lucide-react";
import API_BASE from "../apiBase";

// ─── ML helpers ───────────────────────────────────────────────
function toMin(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function nowMin() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}
function toDisplay(min) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

// Which ML vehicle IDs are actively running right now?
function getActiveMLIds(mlData, currentMin) {
  if (!mlData) return new Set();
  const p1 = mlData.phase1?.first_round_assignments  ?? [];
  const p2 = mlData.phase2?.second_round_assignments ?? [];
  const active = new Set();
  for (const a of [...p1, ...p2]) {
    const s = toMin(a.start_time);
    const e = toMin(a.end_time ?? a.arrival_time);
    if (s !== null && e !== null && currentMin >= s && currentMin < e)
      active.add(a.vehicle_id);
  }
  return active;
}

// Positional map: bus_code → ML vehicle_id
// MUST sort ALL buses by bus_code to match ML engine's ordering
function buildCodeToMlId(allBusRoutes, mlData) {
  if (!mlData || !allBusRoutes.length) return {};
  const p1 = mlData.phase1?.first_round_assignments  ?? [];
  const p2 = mlData.phase2?.second_round_assignments ?? [];
  const allMlIds = [...new Set([...p1, ...p2].map(a => a.vehicle_id))].sort();
  const sorted   = [...allBusRoutes].sort((a, b) => a.bus_code.localeCompare(b.bus_code));
  const map = {};
  allMlIds.forEach((mlId, i) => { if (sorted[i]) map[sorted[i].bus_code] = mlId; });
  return map;
}

// What is a given ML vehicle doing right now?
function getAssignmentNow(mlData, mlId, currentMin) {
  if (!mlData || !mlId) return null;
  const p1 = mlData.phase1?.first_round_assignments  ?? [];
  const p2 = mlData.phase2?.second_round_assignments ?? [];
  return [...p1, ...p2].find(a => {
    if (a.vehicle_id !== mlId) return false;
    const s = toMin(a.start_time);
    const e = toMin(a.end_time ?? a.arrival_time);
    return s !== null && e !== null && currentMin >= s && currentMin < e;
  }) ?? null;
}

// ─── KIIT campus route waypoints ─────────────────────────────
const CAMPUS_ROUTES = [
  [ [20.3535,85.8140],[20.3548,85.8155],[20.3562,85.8170],[20.3575,85.8162],
    [20.3580,85.8145],[20.3568,85.8130],[20.3550,85.8120],[20.3538,85.8130],[20.3535,85.8140] ],
  [ [20.3520,85.8175],[20.3530,85.8190],[20.3545,85.8200],[20.3560,85.8195],
    [20.3572,85.8180],[20.3565,85.8165],[20.3550,85.8160],[20.3535,85.8165],[20.3520,85.8175] ],
  [ [20.3510,85.8145],[20.3515,85.8162],[20.3525,85.8178],[20.3540,85.8185],
    [20.3555,85.8178],[20.3560,85.8160],[20.3552,85.8145],[20.3538,85.8138],[20.3510,85.8145] ],
  [ [20.3500,85.8130],[20.3505,85.8155],[20.3512,85.8175],[20.3525,85.8195],[20.3542,85.8205],
    [20.3560,85.8200],[20.3575,85.8185],[20.3580,85.8165],[20.3575,85.8145],
    [20.3560,85.8130],[20.3540,85.8120],[20.3520,85.8122],[20.3500,85.8130] ],
];

const STATUS_CFG = {
  active:      { label:"Active",  dot:"#10b981", badge:"bg-emerald-100 text-emerald-700" },
  idle:        { label:"Idle",    dot:"#f59e0b", badge:"bg-amber-100 text-amber-700"     },
  maintenance: { label:"Service", dot:"#ef4444", badge:"bg-red-100 text-red-600"         },
};

function interpolate(a, b, t) { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]; }
function positionOnRoute(route, progress) {
  const total  = route.length - 1;
  const scaled = progress * total;
  const idx    = Math.min(Math.floor(scaled), total - 1);
  return interpolate(route[idx], route[idx+1], scaled - idx);
}
function getRouteIdx(code) {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h*31 + code.charCodeAt(i)) & 0xffff;
  return h % CAMPUS_ROUTES.length;
}

// ─────────────────────────────────────────────────────────────
export default function LiveMap() {
  const mapRef      = useRef(null);
  const leafRef     = useRef(null);
  const markersRef  = useRef({});
  const animRef     = useRef(null);
  const progressRef = useRef({});
  const speedRef    = useRef({});

  // ── Raw data from backend ─────────────────────────────────
  const [drivers,     setDrivers]     = useState([]);  // [{name, phone, vehicle, status}]
  const [allBusRoutes,setAllBusRoutes]= useState([]);  // [{bus_id, bus_code, status, route:[]}]
  const [mlData,      setMlData]      = useState(null);// from /admin/getCurrentAllocation
  const [mlError,     setMlError]     = useState(false);

  const [selected,    setSelected]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [mapReady,    setMapReady]    = useState(false);
  const [currentMin,  setCurrentMin]  = useState(nowMin());

  // Tick clock every minute
  useEffect(() => {
    const id = setInterval(() => setCurrentMin(nowMin()), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Derive ML-aware status for every bus ──────────────────
  const codeToMlId  = buildCodeToMlId(allBusRoutes, mlData);
  const activeMLIds = getActiveMLIds(mlData, currentMin);

  // Build a lookup: driverName by vehicle code
  const driverByCode = {};
  drivers.forEach(d => { driverByCode[d.vehicle] = d.name; });

  // Annotate all buses with ML-aware effective status + assignment detail
  const annotated = allBusRoutes
    .sort((a, b) => a.bus_code.localeCompare(b.bus_code))
    .map(br => {
      const mlId      = codeToMlId[br.bus_code];
      const mlActive  = mlId ? activeMLIds.has(mlId) : false;
      const assignment = getAssignmentNow(mlData, mlId, currentMin);
      const effectiveStatus =
        br.status === "maintenance" ? "maintenance"
        : mlData
          ? (mlActive ? "active" : "idle")
          : br.status;
      return {
        vehicle:         br.bus_code,
        name:            driverByCode[br.bus_code] ?? "—",
        dbStatus:        br.status,
        effectiveStatus,
        assignment,
        mlId,
      };
    });

  const counts = annotated.reduce((acc, d) => {
    acc[d.effectiveStatus] = (acc[d.effectiveStatus] || 0) + 1;
    return acc;
  }, {});

  // ── Load Leaflet ──────────────────────────────────────────
  useEffect(() => {
    const linkId = "leaflet-css";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId; link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const scriptId = "leaflet-js";
    if (document.getElementById(scriptId)) { if (window.L) initMap(); return; }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = initMap;
    document.head.appendChild(script);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []); // eslint-disable-line

  function initMap() {
    if (leafRef.current || !mapRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { center:[20.3548,85.8165], zoom:15, zoomControl:false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom:19,
    }).addTo(map);
    L.control.zoom({ position:"bottomright" }).addTo(map);
    const colors = ["#3b82f6","#8b5cf6","#10b981","#f59e0b"];
    CAMPUS_ROUTES.forEach((r,i) =>
      L.polyline(r, { color:colors[i], weight:3, opacity:0.25, dashArray:"6 6" }).addTo(map)
    );
    leafRef.current = L;
    leafRef.current._map = map;
    setMapReady(true);
  }

  function makeBusIcon(status, isSel) {
    const L   = leafRef.current;
    const dot = STATUS_CFG[status]?.dot ?? "#6366f1";
    const ring = isSel ? `box-shadow:0 0 0 4px ${dot}44;` : "";
    const html = `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);background:${dot};border:3px solid white;
      box-shadow:0 2px 10px rgba(0,0,0,.3);${ring}
      display:flex;align-items:center;justify-content:center;">
      <svg style="transform:rotate(45deg)" xmlns="http://www.w3.org/2000/svg"
        width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="7" width="20" height="13" rx="2"/>
        <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/>
        <circle cx="7" cy="20" r="1"/><circle cx="17" cy="20" r="1"/>
        <line x1="12" y1="7" x2="12" y2="20"/>
      </svg></div>`;
    return L.divIcon({ html, className:"", iconAnchor:[17,34], popupAnchor:[0,-34] });
  }

  // ── Sync markers whenever data changes ────────────────────
  useEffect(() => {
    if (!mapReady || !leafRef.current || annotated.length === 0) return;
    const L = leafRef.current, map = L._map;
    annotated.forEach(d => {
      const code  = d.vehicle;
      const route = CAMPUS_ROUTES[getRouteIdx(code)];
      if (progressRef.current[code] === undefined) {
        progressRef.current[code] = Math.random();
      }
      // Update speed based on current effective status
      speedRef.current[code] =
        d.effectiveStatus === "active"      ? (speedRef.current[code] > 0.00002 ? speedRef.current[code] : 0.000025 + Math.random()*0.000015)
        : d.effectiveStatus === "idle"       ? 0.000004
        : 0;

      const pos = positionOnRoute(route, progressRef.current[code]);
      if (markersRef.current[code]) {
        markersRef.current[code].setIcon(makeBusIcon(d.effectiveStatus, selected === code));
      } else {
        const asgn = d.assignment;
        const popup = `<div style="font-family:sans-serif;min-width:160px">
          <div style="font-weight:700;font-size:14px;margin-bottom:2px">${code}</div>
          <div style="color:#64748b;font-size:12px;margin-bottom:6px">${d.name}</div>
          ${asgn ? `<div style="font-size:11px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:4px 8px;color:#15803d">
            🚏 ${asgn.hostel ?? asgn.to_hostel}<br/>
            🕐 ${asgn.start_time} – ${asgn.end_time ?? asgn.arrival_time}
          </div>` : ""}
        </div>`;
        const m = L.marker(pos, { icon: makeBusIcon(d.effectiveStatus, selected === code) })
          .addTo(map).bindPopup(popup);
        m.on("click", () => setSelected(code));
        markersRef.current[code] = m;
      }
    });
  }, [annotated.length, mapReady, selected, mlData, currentMin]); // eslint-disable-line

  // ── Animation loop ────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    let last = null;
    function frame(ts) {
      const dt = last ? ts - last : 16; last = ts;
      annotated.forEach(d => {
        if (d.effectiveStatus !== "active") return;
        const code  = d.vehicle;
        const route = CAMPUS_ROUTES[getRouteIdx(code)];
        progressRef.current[code] = ((progressRef.current[code] ?? 0) + (speedRef.current[code] ?? 0) * dt) % 1;
        markersRef.current[code]?.setLatLng(positionOnRoute(route, progressRef.current[code]));
      });
      animRef.current = requestAnimationFrame(frame);
    }
    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  }, [annotated.length, mapReady, mlData]); // eslint-disable-line

  // ── Pan to selected bus ───────────────────────────────────
  useEffect(() => {
    if (!selected || !mapReady) return;
    const m = markersRef.current[selected];
    if (m) leafRef.current._map.panTo(m.getLatLng(), { animate: true });
  }, [selected, mapReady]);

  // ── Fetch all backend data ────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [dRes, rRes, mlRes] = await Promise.all([
        fetch(`${API_BASE}/admin/getDriverDetails`,   { credentials:"include" }),
        fetch(`${API_BASE}/getBusRoutes`,             { credentials:"include" }),
        fetch(`${API_BASE}/admin/getCurrentAllocation`, { credentials:"include" }),
      ]);

      if (dRes.ok)  { const d = await dRes.json();  setDrivers(Array.isArray(d) ? d : []); }
      if (rRes.ok)  { const r = await rRes.json();  setAllBusRoutes(Array.isArray(r) ? r : []); }

      if (mlRes.ok) {
        const ml = await mlRes.json();
        // Response shape: { phase1: {...}, phase2: {...} }
        // OR wrapped: { result: { phase1: {...}, phase2: {...} } }
        const unwrapped = ml?.phase1 ? ml : ml?.result ?? null;
        setMlData(unwrapped);
        setMlError(false);
      } else {
        // 404 = no simulation run yet; that's fine
        setMlError(mlRes.status !== 404);
      }

      setLastUpdated(new Date());
    } catch(e) {
      console.error("LiveMap fetch:", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const poll = setInterval(fetchAll, 15_000); // refresh every 15 s
    return () => clearInterval(poll);
  }, [fetchAll]);

  const selBus = selected ? annotated.find(x => x.vehicle === selected) : null;

  // ── Round indicator ───────────────────────────────────────
  function roundTag(assignment) {
    if (!assignment) return null;
    const round = assignment.round ?? (assignment.to_hostel ? 2 : 1);
    return (
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full
        ${round === 1 ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
        R{round}
      </span>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] bg-slate-100 flex flex-col md:flex-row">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <div className="w-full md:w-96 bg-white border-r border-slate-200 z-10 flex flex-col shadow-xl">

        {/* Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Fleet Monitor</h1>
              <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1.5">
                <Radio size={9} className="text-emerald-500 animate-pulse"/>
                {lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`
                  : "Connecting…"}
                <span className="mx-1">·</span>
                <span className="font-mono font-semibold text-slate-500">{toDisplay(currentMin)}</span>
              </p>
            </div>
            <button onClick={fetchAll}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 text-slate-400 transition-all">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""}/>
            </button>
          </div>

          {/* ML status pill */}
          <div className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-xl w-fit mb-3 border
            ${mlData
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : mlError
                ? "bg-red-50 text-red-600 border-red-200"
                : "bg-amber-50 text-amber-600 border-amber-200"}`}>
            {mlData
              ? <><CheckCircle2 size={10}/> ML schedule active — statuses reflect live assignments</>
              : mlError
                ? <><AlertTriangle size={10}/> Could not load ML data</>
                : <><AlertTriangle size={10}/> No ML simulation run yet — showing DB status</>}
          </div>

          {/* Status counts */}
          <div className="flex gap-2">
            {[
              { key:"active",      icon:Bus,    label:"Active",  cls:"bg-emerald-50 text-emerald-700 border-emerald-200" },
              { key:"idle",        icon:Clock,  label:"Idle",    cls:"bg-amber-50 text-amber-700 border-amber-200"       },
              { key:"maintenance", icon:Wrench, label:"Service", cls:"bg-red-50 text-red-600 border-red-200"             },
            ].map(({ key, icon:Icon, label, cls }) => (
              <div key={key} className={`flex-1 flex flex-col items-center py-2 rounded-xl border ${cls}`}>
                <Icon size={12} className="mb-0.5"/>
                <span className="text-xl font-black leading-none">{counts[key] ?? 0}</span>
                <span className="text-[9px] font-semibold opacity-70 mt-0.5">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bus list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
          {loading && annotated.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <RefreshCw size={24} className="animate-spin opacity-40"/>
              <p className="text-sm">Loading fleet data…</p>
            </div>
          )}
          {!loading && annotated.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <Bus size={32} className="opacity-30"/>
              <p className="text-sm">No vehicles found</p>
            </div>
          )}
          {annotated.map(d => {
            const cfg    = STATUS_CFG[d.effectiveStatus] ?? STATUS_CFG.idle;
            const isSel  = selected === d.vehicle;
            const asgn   = d.assignment;
            return (
              <button key={d.vehicle}
                onClick={() => setSelected(s => s === d.vehicle ? null : d.vehicle)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all
                  ${isSel
                    ? "border-blue-300 bg-blue-50 shadow-sm"
                    : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm"}`}>

                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                      ${d.effectiveStatus === "active"      ? "bg-emerald-100 text-emerald-700"
                        : d.effectiveStatus === "maintenance" ? "bg-red-100 text-red-500"
                        : "bg-amber-50 text-amber-600"}`}>
                      <Bus size={16}/>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm leading-none">{d.vehicle}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[120px]">{d.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {asgn && roundTag(asgn)}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.badge}`}>
                      {d.effectiveStatus === "active" &&
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>}
                      {cfg.label}
                    </span>
                  </div>
                </div>

                {/* ML assignment detail — hostel + time window */}
                {d.effectiveStatus === "active" && asgn && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5 mt-1">
                    <Zap size={10} className="shrink-0"/>
                    <span className="font-semibold truncate">
                      {asgn.hostel ?? asgn.to_hostel}
                    </span>
                    <span className="text-emerald-400 mx-0.5">·</span>
                    <span className="font-mono text-[10px]">
                      {asgn.start_time}–{asgn.end_time ?? asgn.arrival_time}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-slate-100 bg-white">
          <p className="text-[10px] text-slate-400 text-center">
            {mlData
              ? "Active status driven by ML in-memory schedule · auto-refreshes every 15 s"
              : "Showing DB status · run a simulation in ML Insights to enable live tracking"}
          </p>
        </div>
      </div>

      {/* ── Map ─────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0 z-0"/>

        {/* Selected bus banner */}
        {selBus && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[999] bg-white/95 backdrop-blur-md shadow-xl rounded-2xl px-5 py-3 flex items-center gap-4 border border-slate-200 pointer-events-none max-w-sm w-full mx-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Bus size={18}/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800">{selBus.vehicle}</p>
              <p className="text-xs text-slate-400 truncate">{selBus.name}</p>
              {selBus.assignment && (
                <p className="text-[11px] text-emerald-600 mt-0.5 font-semibold">
                  → {selBus.assignment.hostel ?? selBus.assignment.to_hostel}
                  &nbsp;·&nbsp;
                  {selBus.assignment.start_time}–{selBus.assignment.end_time ?? selBus.assignment.arrival_time}
                </p>
              )}
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${STATUS_CFG[selBus.effectiveStatus]?.badge}`}>
              {STATUS_CFG[selBus.effectiveStatus]?.label}
            </span>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-8 right-14 z-[999] bg-white/90 backdrop-blur rounded-xl shadow-md border border-slate-200 px-3 py-2.5 flex flex-col gap-1.5 pointer-events-none">
          {Object.entries(STATUS_CFG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background:cfg.dot }}/>
              {cfg.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}