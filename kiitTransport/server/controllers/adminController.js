import * as adminQueries from '../queries/adminQueries.js'
import { getLatestAllocation } from '../utils/mlState.js'
import { syncFleetStatusInternal } from '../utils/fleetSync.js'

// ── In-memory waiting queue ───────────────────────────────────
// Each entry is a Unix timestamp (ms) representing when a student marked themselves waiting.
// Entries older than WAITING_TTL_MS are considered expired and not counted.
const WAITING_TTL_MS = 20 * 60 * 1000   // 20 minutes

const waitingQueue = []

/** Remove expired entries from the front of the queue (it's append-only, so oldest are first). */
function pruneExpired() {
    const cutoff = Date.now() - WAITING_TTL_MS
    while (waitingQueue.length && waitingQueue[0] < cutoff) waitingQueue.shift()
}

export const markWaiting = (req, res) => {
    waitingQueue.push(Date.now())
    pruneExpired()
    return res.json({ message: 'Marked as waiting', count: waitingQueue.length })
}

export const getWaitingCount = (req, res) => {
    pruneExpired()
    return res.json({ count: waitingQueue.length })
}


export const getDriverDetails = async (req, res) => {
    const { role } = req.user
    if (role !== 'admin') return res.status(403).json({ message: 'Unauthorized User' })
    try {
        const result = await adminQueries.getDriverDetails()
        return res.json(result)
    } catch (e) {
        console.log(e.message)
        return res.status(500).json({ message: "Internal Server Error" })
    }
}

export const getTotalActiveIdleMaintenanceBuses = async (req, res) => {
    const { role } = req.user
    if (role !== 'admin') return res.status(403).json({ message: 'Unauthorized User' })
    try {
        const result = await adminQueries.getTotalActiveIdleMaintenanceBuses()
        return res.json(result)
    } catch (e) {
        console.log(e.message)
        return res.status(500).json({ message: "Internal Server Error" })
    }
}

export const getCurrentAllocation = (req, res) => {
    const data = getLatestAllocation()
    if (!data) return res.status(404).json({ message: "No allocation yet" })
    return res.json(data)
}

export const updateBusStatus = async (req, res) => {
    const { role } = req.user
    if (role !== 'admin') return res.status(403).json({ message: 'Unauthorized User' })
    const { busId, status } = req.body
    if (!busId || !status) return res.status(400).json({ message: 'Missing fields' })
    const allowedStatuses = ['active', 'idle', 'maintenance']
    if (!allowedStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status value' })
    try {
        await adminQueries.updateBusStatus(busId, status)
        return res.json({ message: 'Status updated successfully' })
    } catch (e) {
        console.log(e.message)
        return res.status(500).json({ message: 'Internal Server Error' })
    }
}

export const updateBusRoute = async (req, res) => {
    const { role } = req.user
    if (role !== 'admin') return res.status(403).json({ message: 'Unauthorized User' })
    const { busId, stopIds } = req.body
    if (!busId || !Array.isArray(stopIds) || stopIds.length !== 2)
        return res.status(400).json({ message: 'Exactly 2 stops required (Source & Destination)' })
    const [source, destination] = stopIds
    if (source === destination) return res.status(400).json({ message: 'Source and Destination cannot be same' })
    try {
        await adminQueries.updateBusRoute(busId, stopIds)
        return res.json({ message: 'Route updated successfully' })
    } catch (err) {
        console.log(err.message)
        return res.status(500).json({ message: 'Internal Server Error' })
    }
}

// ── Sync Fleet Status ─────────────────────────────────────────────────
// Sets first mlBusCount DB buses (sorted by code) to 'active', rest to 'idle'.
// Maintenance vehicles are never touched.
export const syncFleetStatus = async (req, res) => {
    const { role } = req.user
    if (role !== 'admin') return res.status(403).json({ message: 'Unauthorized User' })

    const { mlBusCount } = req.body
    if (mlBusCount === undefined) return res.status(400).json({ message: 'mlBusCount is required' })

    try {
        const result = await syncFleetStatusInternal(Number(mlBusCount))
        return res.json({ message: 'Fleet status synced successfully', ...result })
    } catch (e) {
        console.log(e.message)
        return res.status(500).json({ message: 'Internal Server Error' })
    }
}