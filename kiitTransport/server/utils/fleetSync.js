import pool from '../utils/db.js'

/**
 * Sync fleet DB statuses to match the ML allocation counts.
 *
 * Your buses table has: id, code, status  (no vehicle_type column).
 * All DB entries are treated as buses. Shuttles only exist in ML logic.
 *
 * - First mlBusCount buses sorted by code ASC → 'active'
 * - Remaining buses                           → 'idle'
 * - 'maintenance' vehicles are never touched.
 */
export async function syncFleetStatusInternal(mlBusCount) {
    const { rows: allBuses } = await pool.query(
        `SELECT id, code, status FROM buses ORDER BY code ASC`
    )

    const updates = []

    allBuses.forEach((bus, idx) => {
        if (bus.status === 'maintenance') return
        const target = idx < mlBusCount ? 'active' : 'idle'
        if (bus.status !== target) updates.push({ id: bus.id, status: target })
    })

    for (const { id, status } of updates) {
        await pool.query(`UPDATE buses SET status = $1 WHERE id = $2`, [status, id])
    }

    return { updated: updates.length }
}