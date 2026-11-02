import { pool } from "../src/lib/db";

async function main(){
    try{
        await pool.query("TRUNCATE drill_vectors")

        const insertQuery = `INSERT INTO drill_vectors (label, embedding) VALUES ($1, $2)`

        await pool.query(insertQuery, ["east", "[1,0,0]"])
        await pool.query(insertQuery, ["almost east", "[0.9,0.1,0]"])
        await pool.query(insertQuery, ["up", "[0,0,1]"])

        const targetVector = "[1,0,0]";

        const selectQuery = `SELECT label, embedding <=> $1 AS distance FROM drill_vectors ORDER BY distance ASC`

        const result = await pool.query(selectQuery, [targetVector]);

        console.table(result.rows);

    }catch(error){
        console.error("Error running drill:", error)   
        } finally{
            await pool.end();
        }
    }

main();