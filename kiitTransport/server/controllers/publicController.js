import * as publicQueries from '../queries/publicQueries.js'

export const getBusRoutes = async (req, res) => {
    try {
        const result = await publicQueries.getBusRoutes()
        res.json(result)
    } catch (e) {
        console.log(e.message)
        res.status(500).json({ message: 'Internal Server Error' })
    }
}

export const getStops = async (req, res) => {
    try {
        const result = await publicQueries.getStops()
        res.json(result)
    } catch (e) {
        console.log(e.message)
        res.status(500).json({ message: 'Internal Server Error' })
    }
}

// Live: active buses only (used by real users)
export const getBusesForRoutes = async (req, res) => {
    const { pickupId, dropId } = req.body
    try {
        const result = await publicQueries.getBusesForRoutes(pickupId, dropId)
        res.json(result)
    } catch (e) {
        console.log(e.message)
        res.status(500).json({ message: 'Internal Server Error' })
    }
}

// Test mode: all buses on route, no status filter
// Frontend determines active/idle from ML sessionStorage at simulated time
export const getBusesForRoutesAll = async (req, res) => {
    const { pickupId, dropId } = req.body
    try {
        const result = await publicQueries.getBusesForRoutesAll(pickupId, dropId)
        res.json(result)
    } catch (e) {
        console.log(e.message)
        res.status(500).json({ message: 'Internal Server Error' })
    }
}