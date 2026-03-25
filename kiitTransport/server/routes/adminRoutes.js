import express from 'express'
import {
    getDriverDetails,
    getTotalActiveIdleMaintenanceBuses,
    getCurrentAllocation,
    updateBusStatus,
    updateBusRoute,
    syncFleetStatus,
    markWaiting,
    getWaitingCount,
} from '../controllers/adminController.js'
import authMiddleware from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/getDriverDetails',                    authMiddleware, getDriverDetails)
router.get('/getTotalActiveIdleMaintenanceBuses',  authMiddleware, getTotalActiveIdleMaintenanceBuses)
router.get('/getCurrentAllocation',                authMiddleware, getCurrentAllocation)
router.patch('/updateBusStatus',                   authMiddleware, updateBusStatus)
router.patch('/updateBusRoute',                    authMiddleware, updateBusRoute)
router.post('/syncFleetStatus',                    authMiddleware, syncFleetStatus)

// ── Student waiting ───────────────────────────────────────────────────
// markWaiting is intentionally PUBLIC — any student can signal they're waiting
// without needing an admin session. The 20-min rate-limit is enforced client-side
// (localStorage) so the server just acts as a dumb counter.
// getWaitingCount stays admin-only so only the dashboard can read it.
router.post('/markWaiting',   markWaiting)
router.get('/getWaitingCount', authMiddleware, getWaitingCount)

export default router