const express = require('express');
const router = express.Router();
const User = require('../models/userSchema');
const Wallet=require('../models/walletSchema')
const nodemailer = require('nodemailer');
const bcrypt=require('bcrypt')
// controller
const userProfileController=require('../controllers/userprofileController')
// Middleware
const { jwtAuth, userProtected } = require('../middlewares/auth');
const { postVerify } = require('../controllers/authController');

// Apply authentication middleware
router.use(jwtAuth, userProtected);
// auth: {
//     user: 'lijons13@gmail.com',
//     pass: 'cbyb zggu etpz yhsu'
// }
// Get user profile
router.get('/', userProfileController.getProfile);


// Handle profile update


router.get('/edit',userProfileController.getEditProfile);

// Render OTP verification page
router.get('/verify-otp', userProfileController.getVerifyOtp);
// Handle profile update

router.post('/edit', userProfileController.postEditProfile);
// Handle OTP verification
router.post('/verify-otp', userProfileController.postVerifyOtp );


// passsword section 

router.get('/change-password',userProfileController.getChangePassword)
router.post('/change-password',userProfileController.postChangePassword)


// wallet
router.get('/wallet',async(req,res)=>{
    try {
        const wallet=await Wallet.findOne({userId:req.user._id})
        if(!wallet){
            const newWallet=await Wallet.create({userId:req.user._id})
            return res.render('profile/wallet',{wallet:newWallet})
        }
        res.render('profile/wallet',{wallet:wallet})
    } catch (error) {
        
    }
})



module.exports = router;
