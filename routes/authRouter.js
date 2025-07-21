const express=require('express');

const router=express.Router();

const authController=require('../controllers/authController');
const { auth } = require('google-auth-library');




router.get('/signin',authController.getSignin)
router.post('/signin',authController.postSignin)
router.get('/signup',authController.getSignup)
// ''''''''''''''''''''''''''''''''''''''''''''''''''



// ''''''''''''''''''''''''''''''''''''''''''''''''''
router.get('/forgot-password',authController.getForgotpassword)
router.get('/password/reset/:token',authController.getPasswordreset)
router.get('/reset-success',authController.getResetsuccess)
router.post('/forgot-password',authController.postForgotpassword)
router.post('/password/reset/:token',authController.postPasswordreset)

let otp;
let otpExpirationTime;
let oremail;
let temperaluserData = {};

router.post('/signup',authController.postSignup);

router.get('/otp', authController.getOtp);

router.post('/resend', authController.postResend);

router.post('/verify', authController.postVerify);


router.get('/logout',authController.getLogout)

module.exports=router;

