import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
dotenv.config()

const authMiddleware = (req, res, next) => {
    try {
        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized: No token' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user={
            id:decoded.id,
            role:decoded.role
        }

        next();
    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
};

export default authMiddleware