import express from 'express'
import authMiddleware  from '../middleware/authMiddleware.js'
const router = express.Router()


router.get('/me', authMiddleware, (req,res)=>{
    res.json({
        id:req.user.id,
        role:req.user.role
    })
})


export default router