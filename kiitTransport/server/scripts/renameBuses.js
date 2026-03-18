import pool from '../utils/db.js'

const renameBuses = async () => {
    const client = await pool.connect()

    try {
        await client.query("BEGIN")

        // Get all buses ordered by id
        const res = await client.query(`
            SELECT id FROM buses ORDER BY id
        `)

        const buses = res.rows

        for (let i = 0; i < buses.length; i++) {
            const newCode = `BUS-${String(i + 1).padStart(2, '0')}`

            await client.query(
                `UPDATE buses SET code = $1 WHERE id = $2`,
                [newCode, buses[i].id]
            )

            console.log(`Updated Bus ID ${buses[i].id} → ${newCode}`)
        }

        await client.query("COMMIT")
        console.log("✅ All buses renamed successfully")
    } catch (err) {
        await client.query("ROLLBACK")
        console.error("❌ Error:", err.message)
    } finally {
        client.release()
        process.exit()
    }
}

renameBuses()