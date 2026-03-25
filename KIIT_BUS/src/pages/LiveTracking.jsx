import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Bus, Navigation, RefreshCw, Radio, Wrench, Clock, Users } from "lucide-react";
import API_BASE from "../apiBase";

// ── KIIT campus route waypoints (lat/lng) ────────────────────
// These are real roads on/around KIIT University, Bhubaneswar
const CAMPUS_ROUTES = [
  // Route A: Main gate loop (Campus 1 → Campus 2 → Hostel belt)
  [
    [20.3535, 85.8140], [20.3548, 85.8155], [20.3562, 85.8170],
    [20.3575, 85.8162], [20.3580, 85.8145], [20.3568, 85.8130],
    [20.3550, 85.8120], [20.3538, 85.8130], [20.3535, 85.8140],
  ],
  // Route B: Hostel K → Academic block loop
  [
    [20.3520, 85.8175], [20.3530, 85.8190], [20.3545, 85.8200],
    [20.3560, 85.8195], [20.3572, 85.8180], [20.3565, 85.8165],
    [20.3550, 85.8160], [20.3535, 85.8165], [20.3520, 85.8175],
  ],
  // Route C: Campus 11 → KIMS hospital loop
  [
    [20.3510, 85.8145], [20.3515, 85.8162], [20.3525, 85.8178],
    [20.3540, 85.8185], [20.3555, 85.8178], [20.3560, 85.8160],
    [20.3552, 85.8145], [20.3538, 85.8138], [20.3510, 85.8145],
  ],
  // Route D: Outer ring road
  [
    [20.3500, 85.8130], [20.3505, 85.8155], [20.3512, 85.8175],
    [20.3525, 85.8195], [20.3542, 85.8205], [20.3560, 85.8200],
    [20.3575, 85.8185], [20.3580, 85.8165], [20.3575, 85.8145],
    [20.3560, 85.8130], [20.3540, 85.8120], [20.3520, 85.8122],
    [20.3500, 85.8130],
  ],
];

const ROUTE_NAMES = [
  "Main Gate → Campus 2",
  "Hostel K → Academic Block",
  "Campus 11 → KIMS",
  "Outer Ring Road",
];

const STATUS_CONFIG = {
  active:      { label: "Active",      dot: "#10b981", badge: "bg-emerald-100 text-emerald-700" },
  idle:        { label: "Idle",        dot: "#f59e0b", badge: "bg-amber-100 text-amber-700" },
  maintenance: { label: "Service",     dot: "#ef4444", badge: "bg-red-100 text-red-700" },
};

// Interpolate position between two waypoints given a 0-1 fraction
function interpolate(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// Get position along route given a 0-1 progress
function positionOnRoute(route, progress) {
  const total = route.length - 1;
  const scaled = progress * total;
  const idx = Math.min(Math.floor(scaled), total - 1);
  const frac = scaled - idx;
  return interpolate(route[idx], route[idx + 1], frac);
}

export default function LiveMap() {
  const mapRef        = useRef(null);
  const leafletRef    = useRef(null);   // L instance
  const markersRef    = useRef({});     // busCode → L.Marker
  const animFrameRef  = useRef(null);
  const progressRef   = useRef({});     // busCode → 0..1 progress
  const speedRef      = useRef({});     // busCode → speed per ms

  const [drivers,     setDrivers]     = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [mapReady,    setMapReady]    = useState(false);

  // Assign a deterministic route index to each bus based on its code
  const getRouteIdx = (code) => {
    let hash = 0;
    for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) & 0xffff;
    return hash % CAMPUS_ROUTES.length;
  };

  // ── Load Leaflet CSS + JS dynamically ───────────────────────
  useEffect(() => {
    const linkId = "leaflet-css";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id   = linkId;
      link.rel  = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const scriptId = "leaflet-js";
    if (document.getElementById(scriptId)) {
      if (window.L) initMap();
      return;
    }
    const script   = document.createElement("script");
    script.id      = scriptId;
    script.src     = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload  = initMap;
    document.head.appendChild(script);

    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []); // eslint-disable-line

  // ── Initialise Leaflet map ───────────────────────────────────
  function initMap() {
    if (leafletRef.current || !mapRef.current) return;
    const L = window.L;
    leafletRef.current = L;

    const map = L.map(mapRef.current, {
      center: [20.3548, 85.8165],
      zoom: 15,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Draw route polylines faintly
    CAMPUS_ROUTES.forEach((route, i) => {
      const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"];
      L.polyline(route, { color: colors[i], weight: 3, opacity: 0.35, dashArray: "6 6" }).addTo(map);
    });

    // Store map on ref so markers can be added later
    leafletRef.current._map = map;
    setMapReady(true);
  }

  // ── Make a custom bus icon ───────────────────────────────────
  function makeBusIcon(status, isSelected) {
    const L = leafletRef.current;
    const dot = STATUS_CONFIG[status]?.dot ?? "#6366f1";
    const ring = isSelected ? `box-shadow:0 0 0 3px ${dot}55;` : "";
    const html = `
      <div style="
        width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        background:${dot};border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);${ring}
        display:flex;align-items:center;justify-content:center;
      ">
        <svg style="transform:rotate(45deg)" xmlns="http://www.w3.org/2000/svg"
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="7" width="20" height="13" rx="2"/>
          <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/>
          <circle cx="7" cy="20" r="1"/><circle cx="17" cy="20" r="1"/>
          <line x1="12" y1="7" x2="12" y2="20"/>
        </svg>
      </div>`;
    return L.divIcon({ html, className: "", iconAnchor: [18, 36], popupAnchor: [0, -36] });
  }

  // ── Add / update markers when drivers or mapReady changes ───
  useEffect(() => {
    if (!mapReady || !leafletRef.current || drivers.length === 0) return;
    const L   = leafletRef.current;
    const map = L._map;

    drivers.forEach((d) => {
      const code     = d.vehicle;
      const routeIdx = getRouteIdx(code);
      const route    = CAMPUS_ROUTES[routeIdx];

      // Initialise progress randomly so buses don't all start at same point
      if (progressRef.current[code] === undefined) {
        progressRef.current[code] = Math.random();
        // Active buses move fast, idle very slow, maintenance stationary
        speedRef.current[code] =
          d.status === "active"      ? 0.000025 + Math.random() * 0.000015 :
          d.status === "idle"        ? 0.000005 :
          0; // maintenance — stopped
      }

      const pos = positionOnRoute(route, progressRef.current[code]);

      if (markersRef.current[code]) {
        markersRef.current[code].setIcon(makeBusIcon(d.status, selected === code));
      } else {
        const marker = L.marker(pos, { icon: makeBusIcon(d.status, selected === code) })
          .addTo(map)
          .bindPopup(`<strong>${code}</strong><br/>${d.name}<br/>${ROUTE_NAMES[routeIdx]}`);
        marker.on("click", () => setSelected(code));
        markersRef.current[code] = marker;
      }
    });
  }, [drivers, mapReady, selected]); // eslint-disable-line

  // ── Animation loop — move active buses along routes ─────────
  useEffect(() => {
    if (!mapReady) return;

    let last = null;
    function frame(ts) {
      const dt = last ? ts - last : 16;
      last = ts;

      drivers.forEach((d) => {
        if (d.status !== "active") return;
        const code  = d.vehicle;
        const route = CAMPUS_ROUTES[getRouteIdx(code)];
        progressRef.current[code] = (progressRef.current[code] + speedRef.current[code] * dt) % 1;
        const pos = positionOnRoute(route, progressRef.current[code]);
        markersRef.current[code]?.setLatLng(pos);
      });

      animFrameRef.current = requestAnimationFrame(frame);
    }

    animFrameRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [drivers, mapReady]); // eslint-disable-line

  // ── Fetch real driver/bus data from backend ──────────────────
  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/getDriverDetails`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setDrivers(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("LiveMap fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
    const poll = setInterval(fetchDrivers, 15_000); // refresh every 15 s
    return () => clearInterval(poll);
  }, [fetchDrivers]);

  // ── Pan to selected bus ──────────────────────────────────────
  useEffect(() => {
    if (!selected || !mapReady) return;
    const marker = markersRef.current[selected];
    if (marker) leafletRef.current._map.panTo(marker.getLatLng(), { animate: true });
  }, [selected, mapReady]);

  // ── Counts ───────────────────────────────────────────────────
  const counts = drivers.reduce(
    (acc, d) => { acc[d.status] = (acc[d.status] || 0) + 1; return acc; },
    {}
  );

  return (
    <div className="h-[calc(100vh-64px)] bg-slate-100 flex flex-col md:flex-row">

      {/* ── Sidebar ── */}
      <div className="w-full md:w-96 bg-white border-r border-slate-200 z-10 flex flex-col shadow-xl">

        {/* Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Fleet Monitor</h1>
              <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1">
                <Radio size={9} className="text-emerald-500 animate-pulse" />
                {lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                  : "Connecting…"}
              </p>
            </div>
            <button onClick={fetchDrivers}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 text-slate-400 transition-all">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Status strip */}
          <div className="flex gap-2">
            {[
              { key: "active",      icon: Bus,     label: "Active",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { key: "idle",        icon: Clock,   label: "Idle",    cls: "bg-amber-50 text-amber-700 border-amber-200" },
              { key: "maintenance", icon: Wrench,  label: "Service", cls: "bg-red-50 text-red-600 border-red-200" },
            ].map(({ key, icon: Icon, label, cls }) => (
              <div key={key} className={`flex-1 flex flex-col items-center py-1.5 rounded-xl border text-xs font-bold ${cls}`}>
                <Icon size={12} className="mb-0.5" />
                <span className="text-base font-black leading-none">{counts[key] ?? 0}</span>
                <span className="text-[9px] font-semibold opacity-70">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bus list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
          {loading && drivers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <RefreshCw size={24} className="animate-spin opacity-40" />
              <p className="text-sm">Loading fleet data…</p>
            </div>
          )}
          {!loading && drivers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <Bus size={32} className="opacity-30" />
              <p className="text-sm">No vehicles found</p>
            </div>
          )}
          {drivers.map((d) => {
            const routeIdx = getRouteIdx(d.vehicle);
            const cfg      = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.idle;
            const isActive = d.status === "active";
            const isSel    = selected === d.vehicle;

            return (
              <button
                key={d.vehicle}
                onClick={() => setSelected(s => s === d.vehicle ? null : d.vehicle)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all
                  ${isSel
                    ? "border-blue-300 bg-blue-50 shadow-sm"
                    : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                      ${isActive ? "bg-emerald-100 text-emerald-700"
                        : d.status === "maintenance" ? "bg-red-100 text-red-500"
                        : "bg-amber-50 text-amber-600"}`}>
                      <Bus size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{d.vehicle}</p>
                      <p className="text-[11px] text-slate-400 truncate max-w-[130px]">{d.name}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.badge}`}>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                    {cfg.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                  <Navigation size={10} className="shrink-0 text-blue-400" />
                  <span className="truncate">{ROUTE_NAMES[routeIdx]}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="px-4 py-3 border-t border-slate-100 bg-white">
          <p className="text-[10px] text-slate-400 text-center">
            Routes are simulated on KIIT campus · GPS positions update live
          </p>
        </div>
      </div>

      {/* ── Map ── */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0 z-0" />

        {/* Top overlay — selected bus info */}
        {selected && (() => {
          const d = drivers.find(x => x.vehicle === selected);
          if (!d) return null;
          const cfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.idle;
          return (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[999] bg-white/95 backdrop-blur shadow-xl rounded-2xl px-5 py-3 flex items-center gap-4 border border-slate-200 pointer-events-none">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <Bus size={18} />
              </div>
              <div>
                <p className="font-bold text-slate-800">{d.vehicle}</p>
                <p className="text-xs text-slate-400">{d.name} · {ROUTE_NAMES[getRouteIdx(d.vehicle)]}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
            </div>
          );
        })()}

        {/* Legend */}
        <div className="absolute bottom-8 right-14 z-[999] bg-white/90 backdrop-blur rounded-xl shadow-md border border-slate-200 px-3 py-2.5 flex flex-col gap-1.5 pointer-events-none">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.dot }} />
              {cfg.label}
            </div>
          ))}
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 mt-0.5 pt-1.5 border-t border-slate-100">
            <span className="w-2.5 h-0.5 bg-blue-400 opacity-50 rounded" style={{ borderTop: "2px dashed #60a5fa" }} />
            Campus Routes
          </div>
        </div>
      </div>
    </div>
  );
}