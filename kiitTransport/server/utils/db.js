import {Pool} from 'pg'
import dotenv from 'dotenv'
dotenv.config()

// const pool = new Pool({
//     host:process.env.DB_HOST,
//     user:process.env.DB_USER,
//     password:process.env.DB_PASS,
//     database:process.env.DB_DATABASE,
//     port:5432
// })

// export default pool

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Neon connection string
  ssl: {
    rejectUnauthorized: false,
  }
});

export default pool;
