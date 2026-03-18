import pool from '../utils/db.js'

export const getBusRoutes = async () => {
    const result = await pool.query(`
        SELECT
        b.id AS bus_id,
        b.code AS bus_code,
        b.status,
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'seq', bs.seq,
                'stop_id', s.id,
                'name', s.name,
                'lat', s.lat,
                'lng', s.lng
            )
            ORDER BY bs.seq
        ) AS route
        FROM buses b
        JOIN bus_stops bs ON bs.bus_id = b.id
        JOIN stops s ON s.id = bs.stop_id
        GROUP BY b.id, b.code, b.status
        ORDER BY b.id
    `)
    return result.rows
}

export const getStops = async () => {
    const res = await pool.query(`
        SELECT *
        FROM stops
        ORDER BY
            REGEXP_REPLACE(name, '[0-9]', '', 'g'),
            CAST(REGEXP_REPLACE(name, '[^0-9]', '', 'g') AS INTEGER)
    `)
    return res.rows
}

// Live mode — only active buses
export const getBusesForRoutes = async (pickupId, dropId) => {
    const res = await pool.query(`
        SELECT
        b.id AS bus_id,
        b.code AS bus_code,
        b.status,
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'seq', bs.seq,
                'stop_id', s.id,
                'name', s.name,
                'lat', s.lat,
                'lng', s.lng
            )
            ORDER BY bs.seq
        ) AS route
        FROM buses b
        JOIN bus_stops bs ON bs.bus_id = b.id
        JOIN stops s ON s.id = bs.stop_id
        JOIN bus_stops p ON p.bus_id = b.id AND p.stop_id = $1
        JOIN bus_stops d ON d.bus_id = b.id AND d.stop_id = $2
        WHERE
            p.seq < d.seq
            AND bs.seq BETWEEN p.seq AND d.seq
            AND b.status = 'active'
        GROUP BY b.id, b.code, b.status
        ORDER BY b.code
    `, [pickupId, dropId])
    return res.rows
}

// Test mode — ALL buses on this route regardless of status
// Frontend filters by ML active IDs at the simulated time
export const getBusesForRoutesAll = async (pickupId, dropId) => {
    const res = await pool.query(`
        SELECT
        b.id AS bus_id,
        b.code AS bus_code,
        b.status,
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'seq', bs.seq,
                'stop_id', s.id,
                'name', s.name,
                'lat', s.lat,
                'lng', s.lng
            )
            ORDER BY bs.seq
        ) AS route
        FROM buses b
        JOIN bus_stops bs ON bs.bus_id = b.id
        JOIN stops s ON s.id = bs.stop_id
        JOIN bus_stops p ON p.bus_id = b.id AND p.stop_id = $1
        JOIN bus_stops d ON d.bus_id = b.id AND d.stop_id = $2
        WHERE
            p.seq < d.seq
            AND bs.seq BETWEEN p.seq AND d.seq
        GROUP BY b.id, b.code, b.status
        ORDER BY b.code
    `, [pickupId, dropId])
    return res.rows
}