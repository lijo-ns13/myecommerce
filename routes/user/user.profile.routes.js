const express = require('express');
const router = express.Router();

const userProfileController = require('../../controllers/user/user.profile.controller');
const { jwtAuth, userProtected, checkBlockedUser } = require('../../middlewares/auth');

router.use(jwtAuth, userProtected, checkBlockedUser);

router.get('/', userProfileController.getProfile);
router.get('/edit', userProfileController.getEditProfile);
router.get('/verify-otp', userProfileController.getVerifyOtp);
router.post('/edit', userProfileController.postEditProfile);
router.post('/verify-otp', userProfileController.postVerifyOtp);
router.get('/change-password', userProfileController.getChangePassword);
router.post('/change-password', userProfileController.postChangePassword);
router.get('/wallet', userProfileController.getWallet);

module.exports = router;
