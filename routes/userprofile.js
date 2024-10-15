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
router.get('/wallet', async (req, res) => {
    try {
        // Find the wallet for the user
        let wallet = await Wallet.findOne({ userId: req.user._id });
        const user = await User.findById(req.user._id);

        // Check if the user already has a walletId
        if (!user.walletId) {
            if (!wallet) {
                // Create a new wallet if none exists
                wallet = await Wallet.create({ userId: req.user._id });
            }
            // Assign the wallet ID to the user and save the user document
            user.walletId = wallet._id;
            await user.save(); // Save the updated user document
        }

        // Render the wallet page with the wallet data
        res.render('profile/wallet', { wallet });
    } catch (error) {
        console.error('Error fetching wallet:', error); // Log the error for debugging
        res.status(500).json({ success: false, message: 'An error occurred while fetching the wallet.' }); // Send error response
    }
});




module.exports = router;
