import pool from '../utils/db.js'
import readlineSync from 'readline-sync'

const renameStops = async () => {
    const client = await pool.connect()

    try {
        await client.query("BEGIN")

        const res = await client.query(`
            SELECT id, name FROM stops ORDER BY id
        `)

        const stops = res.rows

        console.log("\n🔄 Stop Renaming Tool\n")

        for (let stop of stops) {
            console.log(`\nCurrent Stop: ${stop.name}`)

            const newName = readlineSync.question(
                "Enter new name (press Enter to keep same): "
            )

            if (newName.trim() !== "") {
                await client.query(
                    `UPDATE stops SET name = $1 WHERE id = $2`,
                    [newName.trim(), stop.id]
                )
                console.log(`✅ Updated to: ${newName}`)
            } else {
                console.log("⏩ Skipped")
            }
        }

        await client.query("COMMIT")
        console.log("\n🎉 All updates completed successfully")

    } catch (err) {
        await client.query("ROLLBACK")
        console.error("❌ Error:", err.message)
    } finally {
        client.release()
        process.exit()
    }
}

renameStops()