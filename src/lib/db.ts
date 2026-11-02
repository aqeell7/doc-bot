import "dotenv/config"
import PG from "pg";

export const pool = new PG.Pool({
    connectionString: process.env.DATABASE_URL
})