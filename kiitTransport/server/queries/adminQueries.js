import pool from '../utils/db.js'

//this function will send back driver's name , phone , status , vehicle
export const getDriverDetails = async () => {
    const res = await pool.query(`
        SELECT 
        u.name,
        u.phone,
        b.code AS vehicle,
        b.status AS status
        FROM users u
        JOIN drivers d ON u.id = d.user_id
        JOIN buses b ON d.bus_id = b.id
        `)
    return res.rows;
}

//this query will return the total number of active, idle and in maintenance buses
export const getTotalActiveIdleMaintenanceBuses = async() =>{
    const res = await pool.query(`
        SELECT
        COUNT(*) FILTER (WHERE status = 'active')       AS active_buses,
        COUNT(*) FILTER (WHERE status = 'idle')         AS idle_buses,
        COUNT(*) FILTER (WHERE status = 'maintenance')  AS maintenance_buses
        FROM buses
        `)
    return res.rows[0]
}

export const updateBusStatus = async (busId, status) => {
    await pool.query(
        `UPDATE buses SET status = $1 WHERE id = $2`,
        [status, busId]
    );
};

export const updateBusRoute = async (busId, stopIds) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Delete old route
        await client.query(
            `DELETE FROM bus_stops WHERE bus_id = $1`,
            [busId]
        );

        // Insert new route
        for (let i = 0; i < stopIds.length; i++) {
            await client.query(
                `INSERT INTO bus_stops (bus_id, stop_id, seq)
                 VALUES ($1, $2, $3)`,
                [busId, stopIds[i], i + 1]
            );
        }

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
};
