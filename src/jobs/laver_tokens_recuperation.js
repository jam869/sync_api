import mysql from "mysql2/promise";
import { DateTime } from "luxon";

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        const now = DateTime.now().toUTC().toFormat("yyyy-LL-dd HH:mm:ss");

        const sql = "DELETE FROM tokens_recuperation WHERE expiration < ?";
        const [result] = await pool.query(sql, [now]);

        // TODO: log into jobs.log file
        console.log(`Tokens expirés supprimés: ${result.affectedRows}`);
    } catch (err) {
        console.error("Erreur nettoyage:", err);
    } finally {
        process.exit(0);
    }
}

run();