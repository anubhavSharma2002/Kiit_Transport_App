import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Navigation, Bus, Clock, Star, Shield,
  FlaskConical, Search, ArrowRight, ChevronDown,
  Radio, CheckCircle2, AlertTriangle, RefreshCw, Route, Zap,
  Users, Timer
} from 'lucide-react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import API_BASE from '../apiBase'

// ─── Constants ───────────────────────────────────────────────
const ML_STORAGE_KEY = 'kiit_ml_allocation'
const QUICK_TIMES = ['08:00','08:30','08:50','09:00','09:30','10:00','10:30','11:00','13:30','14:00','14:30','15:00']

// ─── Helpers ─────────────────────────────────────────────────
const toMin = t => { if (!t) return null; const [h,m] = t.split(':').map(Number); return h*60+m }
const toDisplay = min => `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`
const nowMin = () => { const n=new Date(); return n.getHours()*60+n.getMinutes() }

function getActiveMLIds(mlData, currentMin) {
  if (!mlData) return new Set()
  const active = new Set()
  const all = [...(mlData.phase1?.first_round_assignments??[]), ...(mlData.phase2?.second_round_assignments??[])]
  for (const a of all) {
    const s=toMin(a.start_time), e=toMin(a.end_time??a.arrival_time)
    if (s!==null && e!==null && currentMin>=s && currentMin<e) active.add(a.vehicle_id)
  }
  return active
}

function buildMlToDbBusIds(allDbBuses, mlData) {
  if (!mlData || !allDbBuses.length) return {}
  const all = [...(mlData.phase1?.first_round_assignments??[]), ...(mlData.phase2?.second_round_assignments??[])]
  const allMlIds = [...new Set(all.map(a=>a.vehicle_id))].sort()
  const sorted   = [...allDbBuses].sort((a,b)=>a.bus_code.localeCompare(b.bus_code))
  const map = {}
  allMlIds.forEach((mlId,i) => { if (sorted[i]) map[mlId]=sorted[i].bus_id })
  return map
}

// ─── Bus Result Card ─────────────────────────────────────────
function BusResultCard({ bus, isActive, mlAssignment }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all
        ${isActive ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
        ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
        <Bus size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-800 text-sm">{bus.bus_code}</span>
          {isActive
            ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Running
              </span>
            : <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">Idle</span>
          }
        </div>
        {mlAssignment && (
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            Serving: <span className="font-semibold text-slate-700">{mlAssignment.hostel}</span>
            <span className="mx-1 text-slate-300">·</span>
            {mlAssignment.start_time}–{mlAssignment.end_time ?? mlAssignment.arrival_time}
          </p>
        )}
        {bus.route?.length > 0 && (
          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
            <MapPin size={9} />
            {bus.route.map(s=>s.name).join(' → ')}
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Find Bus Panel ───────────────────────────────────────────
function FindBusPanel({ testMode, testMinutes, allBusRoutes, mlData }) {
  const [stops,     setStops]     = useState([])
  const [srcId,     setSrcId]     = useState('')
  const [dstId,     setDstId]     = useState('')
  const [results,   setResults]   = useState(null)
  const [searching, setSearching] = useState(false)
  const [searched,  setSearched]  = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/getStops`, { credentials: 'include' })
      .then(r=>r.json()).then(d=>setStops(Array.isArray(d)?d:[]))
      .catch(()=>{})
  }, [])

  const currentMin = testMode ? testMinutes : nowMin()

  const handleSearch = useCallback(async () => {
    if (!srcId || !dstId) { setError('Please select both stops.'); return }
    if (srcId === dstId)  { setError('Source and destination must differ.'); return }
    setError(''); setSearching(true); setSearched(false)
    try {
      const res = await fetch(`${API_BASE}/getBusesForRoutesAll`, {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ pickupId:Number(srcId), dropId:Number(dstId) }),
      })
      const buses = await res.json()
      if (!Array.isArray(buses)) throw new Error('Bad response')

      if (!testMode) {
        setResults(buses.map(b=>({ bus:b, isActive:true, mlAssignment:null })))
      } else {
        const activeMLIds = getActiveMLIds(mlData, currentMin)
        const mlToDbId    = buildMlToDbBusIds(allBusRoutes, mlData)
        const dbToMlId    = Object.fromEntries(Object.entries(mlToDbId).map(([k,v])=>[v,k]))
        const all = [...(mlData?.phase1?.first_round_assignments??[]), ...(mlData?.phase2?.second_round_assignments??[])]
        const annotated = buses.map(b => {
          const mlId = dbToMlId[b.bus_id]
          const isActive = mlId ? activeMLIds.has(mlId) : false
          const myAsgn = all.find(a => a.vehicle_id===mlId && (() => { const s=toMin(a.start_time),e=toMin(a.end_time??a.arrival_time); return s!==null&&e!==null&&currentMin>=s&&currentMin<e })()) ?? null
          return { bus:b, isActive, mlAssignment:myAsgn }
        })
        annotated.sort((a,b)=>(b.isActive?1:0)-(a.isActive?1:0))
        setResults(annotated)
      }
    } catch {
      setError('Failed to fetch buses. Check your connection.')
    } finally {
      setSearching(false); setSearched(true)
    }
  }, [srcId, dstId, testMode, testMinutes, mlData, allBusRoutes, currentMin])

  const activeBuses = results?.filter(r=>r.isActive).length ?? 0

  const StopSelect = ({ value, onChange, icon: Icon, label }) => (
    <div className="flex-1">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{label}</label>
      <div className="relative">
        <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <select value={value} onChange={e=>{onChange(e.target.value);setResults(null);setSearched(false)}}
          className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:border-blue-400 appearance-none cursor-pointer">
          <option value="">Select stop</option>
          {stops.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
          <Search size={15} />
        </div>
        <h3 className="font-bold text-slate-800 text-base">Find a Bus</h3>
        <span className={`ml-auto flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border
          ${testMode ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {testMode
            ? <><FlaskConical size={9}/> Test · {toDisplay(testMinutes)}</>
            : <><Radio size={9} className="animate-pulse"/> Live · {toDisplay(nowMin())}</>}
        </span>
      </div>

      <div className="flex items-end gap-2 mb-4">
        <StopSelect value={srcId} onChange={setSrcId} icon={MapPin}     label="From" />
        <div className="shrink-0 mb-1">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
            <ArrowRight size={14} className="text-slate-500" />
          </div>
        </div>
        <StopSelect value={dstId} onChange={setDstId} icon={Navigation} label="To" />
      </div>

      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1.5 mb-3 bg-red-50 px-3 py-2 rounded-xl border border-red-100">
          <AlertTriangle size={12} /> {error}
        </p>
      )}

      <button onClick={handleSearch} disabled={searching || !srcId || !dstId}
        className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
          ${searching||!srcId||!dstId ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : testMode ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-200'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200'}`}>
        {searching ? <RefreshCw size={14} className="animate-spin"/> : <Search size={14}/>}
        {searching ? 'Searching…' : testMode ? `Search at ${toDisplay(testMinutes)}` : 'Search Buses'}
      </button>

      <AnimatePresence>
        {searched && results !== null && (
          <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="mt-4 overflow-hidden">
            <p className="text-xs font-bold text-slate-600 mb-3">
              {results.length===0 ? 'No buses on this route' : testMode
                ? `${activeBuses} of ${results.length} running at ${toDisplay(testMinutes)}`
                : `${results.length} bus${results.length!==1?'es':''} available`}
              {testMode && results.length>0 && <span className="font-normal text-slate-400 ml-1">({results.length-activeBuses} idle)</span>}
            </p>
            {results.length===0 ? (
              <div className="flex flex-col items-center py-8 text-slate-400 gap-2">
                <Bus size={28} className="opacity-30"/> <p className="text-sm">No buses cover this route</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-0.5">
                {results.map(({ bus, isActive, mlAssignment }) => (
                  <BusResultCard key={bus.bus_id} bus={bus} isActive={isActive} mlAssignment={mlAssignment}/>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Test Mode Panel ─────────────────────────────────────────
function TestPanel({ testMinutes, setTestMinutes, mlData }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <FlaskConical size={14} className="text-amber-600"/>
        <span className="text-sm font-bold text-amber-800">Test Mode</span>
        <span className="text-xs text-amber-600">— simulating at</span>
        <span className="font-mono text-sm font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">{toDisplay(testMinutes)}</span>
        {!mlData
          ? <span className="ml-auto text-[10px] text-amber-500 flex items-center gap-1"><AlertTriangle size={10}/> No ML data</span>
          : <span className="ml-auto text-[10px] text-emerald-600 flex items-center gap-1"><CheckCircle2 size={10}/> ML loaded</span>}
      </div>
      <input type="range" min={0} max={23*60+59} step={1} value={testMinutes}
        onChange={e=>setTestMinutes(Number(e.target.value))} className="w-full accent-amber-500 mb-2"/>
      <div className="flex justify-between text-[10px] text-amber-500 font-mono mb-3">
        {['00:00','06:00','09:00','12:00','15:00','18:00','23:59'].map(t=><span key={t}>{t}</span>)}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <span className="text-xs text-amber-700 font-semibold mr-1 self-center">Jump:</span>
        {QUICK_TIMES.map(t=>(
          <button key={t} onClick={()=>setTestMinutes(toMin(t))}
            className={`text-xs font-mono px-2.5 py-1 rounded-lg border transition-colors
              ${testMinutes===toMin(t) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-100'}`}>
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function Dashboard() {
  const [testMode,     setTestMode]     = useState(false)
  const [testMinutes,  setTestMinutes]  = useState(8*60+30)
  const [mlData,       setMlData]       = useState(null)
  const [allBusRoutes, setAllBusRoutes] = useState([])
  const [showFindBus,  setShowFindBus]  = useState(false)

  // ── Waiting state ─────────────────────────────────────────
  const WAITING_TTL = 20 * 60 * 1000   // 20 min in ms
  const [isWaiting,     setIsWaiting]     = useState(() => {
    const exp = localStorage.getItem('kiit_waiting_expiry')
    return exp ? Date.now() < Number(exp) : false
  })
  const [waitingExpiry, setWaitingExpiry] = useState(() => {
    const exp = localStorage.getItem('kiit_waiting_expiry')
    return exp ? Number(exp) : null
  })
  const [waitingSecsLeft, setWaitingSecsLeft] = useState(0)
  const [waitingLoading,  setWaitingLoading]  = useState(false)

  // countdown ticker
  useEffect(() => {
    if (!isWaiting || !waitingExpiry) return
    const tick = () => {
      const left = Math.max(0, Math.round((waitingExpiry - Date.now()) / 1000))
      setWaitingSecsLeft(left)
      if (left === 0) {
        setIsWaiting(false)
        setWaitingExpiry(null)
        localStorage.removeItem('kiit_waiting_expiry')
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isWaiting, waitingExpiry])

  const handleMarkWaiting = async () => {
    if (isWaiting || waitingLoading) return
    setWaitingLoading(true)
    try {
      const res = await fetch(`${API_BASE}/admin/markWaiting`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const expiry = Date.now() + WAITING_TTL
      localStorage.setItem('kiit_waiting_expiry', String(expiry))
      setWaitingExpiry(expiry)
      setIsWaiting(true)
    } catch (err) {
      console.error('markWaiting failed:', err.message)
    } finally {
      setWaitingLoading(false)
    }
  }

  const fmtCountdown = secs => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0')
    const s = String(secs % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  useEffect(() => {
    try { const s=sessionStorage.getItem(ML_STORAGE_KEY); if(s) setMlData(JSON.parse(s)) } catch(_) {}
    fetch(`${API_BASE}/getBusRoutes`,{credentials:'include'})
      .then(r=>r.json()).then(d=>setAllBusRoutes(Array.isArray(d)?d:[])).catch(()=>{})
  }, [])

  const currentMin = testMode ? testMinutes : nowMin()

  const QUICK_ACTIONS = [
    { label:'Find Bus', icon:Bus,       onClick:()=>setShowFindBus(v=>!v), bg:'bg-blue-50',   text:'text-blue-600' },
    { label:'Routes',   icon:Route,     link:'/routes',                    bg:'bg-green-50',  text:'text-green-600' },
    { label:'Track',    icon:Navigation,link:'/live-tracking',             bg:'bg-orange-50', text:'text-orange-500' },
    { label:'Admin',    icon:Shield,    link:'/admin/login',               bg:'bg-slate-50',  text:'text-slate-500' },
    { label: isWaiting ? fmtCountdown(waitingSecsLeft) : 'Mark Waiting', icon: isWaiting ? Timer : Users, onClick: handleMarkWaiting, bg: isWaiting ? 'bg-emerald-50' : 'bg-purple-50', text: isWaiting ? 'text-emerald-600' : 'text-purple-600' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-12">

      {/* HERO */}
      <section className="relative bg-gradient-to-br from-blue-600 to-indigo-700 text-white pt-12 pb-28 px-6 overflow-hidden rounded-b-[40px] md:rounded-b-[60px] shadow-xl shadow-blue-900/20">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/4 -left-1/4 w-1/2 h-full bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-1/4 -right-1/4 w-3/5 h-full bg-indigo-500/20 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
          {/* LEFT */}
          <motion.div className="md:w-1/2 text-center md:text-left"
            initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.5}}>
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold mb-4 border border-white/20">
              <Star size={12} className="text-yellow-300" fill="currentColor"/>
              Official Campus Transport
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-3 tracking-tight leading-tight">
              Smart Ride.<br/>
              <span className="text-blue-200">Better Campus.</span>
            </h1>
            <p className="text-blue-100 text-base mb-6 leading-relaxed max-w-md mx-auto md:mx-0">
              Real-time tracking, accurate schedules, and seamless transit for everyone at KIIT.
            </p>

            <div className="flex items-center gap-2 justify-center md:justify-start mb-6 flex-wrap">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border
                ${testMode ? 'bg-amber-400/20 border-amber-300/50 text-amber-200' : 'bg-white/10 border-white/20 text-white'}`}>
                {testMode
                  ? <><FlaskConical size={10}/> Test · {toDisplay(testMinutes)}</>
                  : <><Radio size={10} className="animate-pulse text-emerald-300"/> Live · {toDisplay(currentMin)}</>}
              </div>
              <button onClick={()=>setTestMode(t=>!t)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all
                  ${testMode ? 'bg-amber-400 text-amber-900 border-amber-300' : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'}`}>
                {testMode ? 'Exit Test' : 'Test Mode'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <button onClick={()=>setShowFindBus(v=>!v)}
                className="h-12 px-6 rounded-2xl font-bold text-sm bg-white text-blue-700 shadow-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                <Search size={16}/> Find a Bus
              </button>
              <Link to="/live-tracking">
                <button className="h-12 px-6 rounded-2xl font-bold text-sm bg-white/15 text-white border border-white/20 hover:bg-white/25 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto">
                  Live Map
                </button>
              </Link>
            </div>
          </motion.div>

          {/* RIGHT */}
          <motion.div className="md:w-1/2 w-full"
            initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} transition={{delay:0.2,duration:0.5}}>
            <AnimatePresence mode="wait">
              {showFindBus ? (
                <motion.div key="findbus" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
                  <FindBusPanel testMode={testMode} testMinutes={testMinutes} allBusRoutes={allBusRoutes} mlData={mlData}/>
                </motion.div>
              ) : (
                <motion.div key="preview" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-3xl shadow-2xl">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center shadow-lg shadow-yellow-400/30">
                        <Bus className="text-orange-900" size={22}/>
                      </div>
                      <div>
                        <p className="font-bold text-lg">Arriving Now</p>
                        <p className="text-blue-100 text-sm">Route 4 · Campus 12</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="font-bold text-2xl">2 <span className="text-sm font-normal text-blue-200">min</span></p>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 flex gap-4 items-center mb-2">
                      <div className="w-10 h-10 rounded-full bg-blue-500/30 flex items-center justify-center"><MapPin size={18}/></div>
                      <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full w-2/3 bg-emerald-400 rounded-full"/>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-emerald-500/30 flex items-center justify-center"><Navigation size={18}/></div>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-blue-200 mt-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                      Live GPS Tracking Active
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* TEST MODE PANEL */}
      <AnimatePresence>
        {testMode && (
          <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 pt-6">
              <TestPanel testMinutes={testMinutes} setTestMinutes={setTestMinutes} mlData={mlData}/>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT */}
      <div className="max-w-7xl mx-auto px-6 -mt-14 relative z-20">

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {[
            { icon:Clock,  badge:"Next Bus",  title:"Campus 12 → KIMS",       sub:"5 min away",     subColor:"text-emerald-600", link:"/live-tracking", btnLabel:"Track Now",  delay:0 },
            { icon:Star,   badge:null,        title:"Route 5 Express",         sub:"Daily · 8:30 AM", subColor:"text-slate-500",  link:"/select-route",  btnLabel:"Book Seat",  delay:0.08 },
            { icon:Shield, badge:"Verified",  title:"Safe Travel",             sub:"All buses sanitized daily and GPS-tracked.", subColor:"text-slate-500", link:null, btnLabel:null, delay:0.16 },
          ].map((c,i)=>(
            <Card key={i} className="!p-6 border-0 shadow-xl shadow-slate-200/50" hover delay={c.delay}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <c.icon size={18}/>
                </div>
                {c.badge && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">{c.badge}</span>}
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">{c.title}</h3>
              <p className={`text-sm mb-4 flex items-center gap-1 ${c.subColor}`}>
                {i===0 && <Clock size={13}/>}{c.sub}
              </p>
              {c.link ? (
                <Link to={c.link}><Button variant="outline" className="w-full text-sm">{c.btnLabel}</Button></Link>
              ) : (
                <Button variant="ghost" className="w-full text-sm text-slate-400 pointer-events-none">Verified ✓</Button>
              )}
            </Card>
          ))}
        </div>

        {/* MARK AS WAITING BANNER */}
        <div className={`mb-8 rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-all duration-500
          ${isWaiting
            ? 'bg-emerald-50 border-emerald-200 shadow-sm shadow-emerald-100/60'
            : 'bg-white border-slate-100 shadow-sm'}`}>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors
            ${isWaiting ? 'bg-emerald-100 text-emerald-600' : 'bg-purple-50 text-purple-600'}`}>
            {isWaiting ? <Timer size={20}/> : <Users size={20}/>}
          </div>
          <div className="flex-1 min-w-0">
            {isWaiting ? (
              <>
                <p className="font-bold text-emerald-700 text-sm">You&apos;re marked as waiting</p>
                <p className="text-xs text-emerald-500 mt-0.5 flex items-center gap-1">
                  <Timer size={11}/>
                  Status expires in&nbsp;<span className="font-mono font-bold">{fmtCountdown(waitingSecsLeft)}</span>
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-slate-800 text-sm">Waiting for a bus?</p>
                <p className="text-xs text-slate-400 mt-0.5">Let the admin know — your status will clear automatically in 20 minutes.</p>
              </>
            )}
          </div>
          <button
            onClick={handleMarkWaiting}
            disabled={isWaiting || waitingLoading}
            className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all
              ${isWaiting
                ? 'bg-emerald-100 text-emerald-500 cursor-default'
                : waitingLoading
                  ? 'bg-purple-100 text-purple-400 cursor-wait'
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-200 active:scale-95'}`}>
            {waitingLoading
              ? <><RefreshCw size={14} className="animate-spin"/> Marking…</>
              : isWaiting
                ? <><CheckCircle2 size={14}/> Marked!</>
                : <><Users size={14}/> Mark As Waiting</>}
          </button>
        </div>

        {/* QUICK ACTIONS */}
        <h2 className="text-lg font-bold text-slate-800 mb-4 px-1">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {QUICK_ACTIONS.map((item,i) => {
            const inner = (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-200 transition-all text-center group">
                <div className={`w-12 h-12 mx-auto ${item.bg} ${item.text} rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <item.icon size={22}/>
                </div>
                <p className="font-bold text-slate-800 text-sm">{item.label}</p>
              </div>
            )
            return item.onClick
              ? <button key={i} onClick={item.onClick} className="text-left">{inner}</button>
              : <Link key={i} to={item.link}>{inner}</Link>
          })}
        </div>
      </div>
    </div>
  )
}