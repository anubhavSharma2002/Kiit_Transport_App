import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Clock, Users, ChevronDown, Bus } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

export default function Routes() {
  const [expandedRoute, setExpandedRoute] = useState(null)

  const busRoutes = [
    {
      id: 1,
      number: 'Route 1',
      name: 'I LOVE KIIT',
      stops: ['KP-6', 'QC-2', 'QC-4', 'KP-1', 'Campus 13', 'Campus 25'],
      schedule: ['6:30 AM', '7:15 AM', '8:00 AM', '8:30 AM', '10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '6:00 PM', '8:00 PM'],
      distance: '4.5 km',
      duration: '25 min',
      buses: 3,
    },
    {
      id: 2,
      number: 'Route 2',
      name: 'East Campus Link',
      stops: ['Hostel C', 'Hostel D', 'Cafeteria', 'Campus 25'],
      schedule: ['6:45 AM', '7:30 AM', '8:15 AM', '9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM', '5:00 PM', '7:00 PM', '9:00 PM'],
      distance: '5.2 km',
      duration: '28 min',
      buses: 2,
    },
    {
      id: 3,
      number: 'Route 3',
      name: 'West Campus Circle',
      stops: ['Hostel A', 'Hostel C', 'Sports Complex', 'Campus 25'],
      schedule: ['7:00 AM', '8:00 AM', '9:00 AM', '10:30 AM', '12:30 PM', '2:30 PM', '4:30 PM', '6:30 PM'],
      distance: '6.0 km',
      duration: '30 min',
      buses: 2,
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 md:px-8 pb-24">
      <div className="max-w-3xl mx-auto">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Bus Routes</h1>
          <p className="text-slate-500">
            Explore all available routes and schedules
          </p>
        </div>

        <div className="space-y-4">
          {busRoutes.map((route, idx) => (
            <Card
              key={route.id}
              className="!p-0 overflow-hidden border-0 shadow-md"
              delay={idx * 0.1}
            >
              {/* HEADER */}
              <div
                onClick={() =>
                  setExpandedRoute(expandedRoute === route.id ? null : route.id)
                }
                className="p-5 bg-white cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm">
                      {route.number.split(' ')[1]}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">
                        {route.name}
                      </h3>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin size={14} />
                        {route.stops.length} Stops • {route.duration}
                      </p>
                    </div>
                  </div>

                  <motion.div
                    animate={{ rotate: expandedRoute === route.id ? 180 : 0 }}
                    className="text-slate-400"
                  >
                    <ChevronDown />
                  </motion.div>
                </div>
              </div>

              <AnimatePresence>
                {expandedRoute === route.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-slate-50 border-t border-slate-100"
                  >
                    <div className="p-5">

                      {/* STATS */}
                      <div className="flex gap-4 mb-6 text-sm flex-wrap">
                        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-lg">
                          <MapPin size={14} className="text-blue-600" />
                          <span className="font-semibold text-slate-800">{route.distance}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-lg">
                          <Clock size={14} className="text-orange-500" />
                          <span className="font-semibold text-slate-800">{route.duration}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-lg">
                          <Bus size={14} className="text-emerald-500" />
                          <span className="font-semibold text-slate-800">{route.buses} Buses</span>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-8">

                        {/* STOPS */}
                        <div>
                          <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">
                            Stops
                          </h4>

                          <div className="relative pl-2 space-y-6">
                            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200" />

                            {route.stops.map((stop, i) => (
                              <div key={stop} className="relative z-10 flex items-center gap-3">
                                <div
                                  className={`w-5 h-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                                    i === 0 || i === route.stops.length - 1
                                      ? 'bg-blue-600'
                                      : 'bg-slate-300'
                                  }`}
                                >
                                  {(i === 0 || i === route.stops.length - 1) && (
                                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                  )}
                                </div>
                                <span
                                  className={`text-sm ${
                                    i === 0 || i === route.stops.length - 1
                                      ? 'font-bold text-slate-800'
                                      : 'text-slate-600'
                                  }`}
                                >
                                  {stop}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* SCHEDULE */}
                        <div>
                          <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">
                            Schedule
                          </h4>

                          <div className="flex flex-wrap gap-2">
                            {route.schedule.map((time, i) => (
                              <div
                                key={i}
                                className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:border-blue-600 hover:text-blue-600 transition-colors cursor-default"
                              >
                                {time}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 flex gap-3">
                        <Button className="flex-1" icon={Users}>
                          See Capacity
                        </Button>
                        <Button variant="outline" className="flex-1" icon={MapPin}>
                          View Map
                        </Button>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}