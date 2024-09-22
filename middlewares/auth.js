const jwt = require('jsonwebtoken');
const userModel=require('../models/userSchema');
const dotenv=require('dotenv').config()
const cookieParser=require('cookie-parser')
exports.jwtAuth=async(req,res,next)=>{
    const token = (req.cookies && req.cookies.token) || null;
    console.log("Token:", token);

    if (!token) {
        console.log("No token provided"); 
        
        return res.status(401).render('protected/userprotected')
        // return res.status(401).json({success:false,message:'token is not provided'})
        // return res.redirect('/')
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Payload:", payload); 
        req.user = { _id: payload._id, role: payload.role };
        
        
        next();
    } catch (e) {
        console.log("Token verification error:", e); 
        return res.status(400).json({
            success: false,
            message: e.message
        });
        // res.redirect('/signin')
    }
    
}

// middlewares/adminProtected.js
exports.adminProtected = (req, res, next) => {
    console.log('admin cheking',req.path)
    
    // Ensure the user is logged in and has the admin role
    if (req.user && req.user.role === 'admin') {
        next(); 
    } else {
        
        return res.status(401).render('protected/adminprotected')
    }
};


// middlewares/userProtected.js
exports.userProtected = (req, res, next) => {
    console.log('user checking',req.path)
    // Ensure the user is logged in and has the user role
    if (req.user&& req.user.role === 'user') {
        next(); 
    } else {
        
        return res.status(403).json({ success: false, message: 'Access denied: User role required ntrtr' });
        // return res.status(403).render('protected/userprotected')
    }
};


