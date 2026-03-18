import express from 'express'
import {
    getBusRoutes,
    getStops,
    getBusesForRoutes,
    getBusesForRoutesAll,
} from '../controllers/publicController.js'

const router = express.Router()

router.get('/getBusRoutes',          getBusRoutes)
router.get('/getStops',              getStops)
router.post('/getBusesForRoutes',    getBusesForRoutes)
router.post('/getBusesForRoutesAll', getBusesForRoutesAll)   // test mode endpoint

export default router