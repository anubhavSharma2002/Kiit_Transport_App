import * as authQueries from '../queries/authQueries.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
dotenv.config()

const emailRegex = /^[a-zA-Z0-9._%+-]+@kiit\.ac\.in$/;
function isValidEmail(email) {
    return emailRegex.test(email);
}


const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
    )
}

export const register = async (req, res) => {
    const { name, email, password, phone, role } = req.body;
    if (!name || !email || !password || !phone) {
        return res.status(400).json({ message: "every field must be filled" })
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ message: "Only KIIT emails allowed" });
    }

    if (!['admin', 'driver'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
    }


    try {
        const existingUser = await authQueries.findUserByEmail(email);
        if (existingUser) return res.status(400).json({ message: "User already registered" })
        const password_hash = await bcrypt.hash(password, 8)
        const newUser = await authQueries.createUser(email, role, password_hash, name, phone);

        const token = generateToken(newUser)
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 3600000, // 1 hour in milliseconds
            sameSite: 'lax' // Allow cross-origin cookies for CORS
        });
        res.status(201).json({ message: "Registration Succesfull" })
    } catch (e) {
        console.log(e.message)
        return res.status(500).json({ message: "registration failed internal server error" })
    }
}

export const login = async (req, res) => {
    const { email, phone, password } = req.body;
    if (!password) return res.status(400).json({ message: "PassWord can't be empty" })
    try {

        let existingUser = null
        if (isValidEmail(email) && email) {
            existingUser = await authQueries.findUserByEmail(email)
        } else {
            existingUser = await authQueries.findUserByPhone(phone)
        }
        if (!existingUser) return res.status(404).json({ message: "User does not exist" })
        const isValidUser = await bcrypt.compare(password, existingUser.password_hash)

        if (!isValidUser) return res.status(400).json({ message: "Invalid credentials" })

        if (isValidUser) {
            const token = generateToken(existingUser)
            res.cookie('token', token, {
                httpOnly: true,
                maxAge: 3600000,
                sameSite: 'lax'
            });
            return res.json({ message: "Login Sucessfull", role: existingUser.role })
        }
    } catch (e) {
        console.log(e.message)
        res.status(500).json({ message: "Internal Server Error" })
    }
}

export const logout = (req, res) => {
    res.clearCookie('token');
    res.status(200).json({ message: "Logged out successfully" });
}