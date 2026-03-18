import express from 'express'
import {
    getDriverDetails,
    getTotalActiveIdleMaintenanceBuses,
    getCurrentAllocation,
    updateBusStatus,
    updateBusRoute,
    syncFleetStatus,
} from '../controllers/adminController.js'
import authMiddleware from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/getDriverDetails',                    authMiddleware, getDriverDetails)
router.get('/getTotalActiveIdleMaintenanceBuses',  authMiddleware, getTotalActiveIdleMaintenanceBuses)
router.get('/getCurrentAllocation',                authMiddleware, getCurrentAllocation)
router.patch('/updateBusStatus',                   authMiddleware, updateBusStatus)
router.patch('/updateBusRoute',                    authMiddleware, updateBusRoute)
router.post('/syncFleetStatus',                    authMiddleware, syncFleetStatus)

export default router