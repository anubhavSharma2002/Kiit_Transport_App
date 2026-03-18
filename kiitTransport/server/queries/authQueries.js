import pool from '../utils/db.js'

export const findUserByEmail = async(email) =>{
    const res = await pool.query(`
        SELECT * FROM users WHERE email=$1
        `,[email])

    return res.rows[0]
}

export const createUser = async(email, role, password, name , phone) =>{
    const res = await pool.query(`
        INSERT INTO users (email,role, password_hash, name, phone) VALUES($1, $2, $3, $4, $5) RETURNING id
        `,[email, role, password, name, phone])
    
    return res.rows[0]
}

export const findUserByPhone = async(phone) =>{
    const res = await pool.query(`
        SELECT * FROM users WHERE phone=$1
        `, phone)
    return res.rows[0]
}