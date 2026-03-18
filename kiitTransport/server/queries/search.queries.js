const { pool } = require("../../config/db");

async function getActiveBusesWithLocation() {
  const result = await pool.query(`
    SELECT 
      b.id,
      b.code,
      b.capacity,
      b.active,
      l.lat,
      l.lng,
      l.timestamp
    FROM buses b
    LEFT JOIN bus_last_locations l ON b.id = l.bus_id
    WHERE b.active = TRUE
  `);

  return result.rows;
}

module.exports = {
  getActiveBusesWithLocation,
};