const express = require("express");
const router = express.Router();
const User = require("../models/userSchema");
const Wallet = require("../models/walletSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
// controller
const userProfileController = require("../controllers/userprofileController");
// Middleware
const { jwtAuth, userProtected } = require("../middlewares/auth");
const { postVerify } = require("../controllers/authController");

// Apply authentication middleware
router.use(jwtAuth, userProtected);

// Get user profile
router.get("/", userProfileController.getProfile);

// Handle profile update

router.get("/edit", userProfileController.getEditProfile);

// Render OTP verification page
router.get("/verify-otp", userProfileController.getVerifyOtp);
// Handle profile update
router.post("/edit", userProfileController.postEditProfile);
// Handle OTP verification
router.post("/verify-otp", userProfileController.postVerifyOtp);

// passsword section
router.get("/change-password", userProfileController.getChangePassword);
router.post("/change-password", userProfileController.postChangePassword);

// wallet
router.get("/wallet", userProfileController.getWallet);

module.exports = router;
