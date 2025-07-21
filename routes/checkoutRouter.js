const express = require('express');
const router = express.Router();

const razorpay = require('razorpay');
const crypto = require('crypto');

const { jwtAuth, userProtected } = require('../middlewares/auth');
const dotenv = require('dotenv').config();
const User = require('../models/userSchema');
const Cart = require('../models/cartSchema');
const Product = require('../models/productSchema');
const Order = require('../models/orderSchema');
const Address = require('../models/addressSchema');
const Coupon = require('../models/couponSchema');
const checkoutController = require('../controllers/checkoutController');
const Category = require('../models/categorySchema');
const Wallet = require('../models/walletSchema');

router.use(jwtAuth, userProtected);

router.get('/', checkoutController.getCheckout);
router.post('/', checkoutController.postCheckout);

// Razorpay instance initialization (put your Razorpay keys here)
const razorpayInstance = new razorpay({
  key_id: 'rzp_test_ovddchQMnrblMK',
  key_secret: 'o0wUHZ0m3cvfpcgmhLx3N4UL',
});
router.post('/checkcatpro', checkoutController.postCheckCatPro);

// Route to handle payment success
router.post('/payment-success', checkoutController.postPaymentSuccess);

router.post('/coupon-check', checkoutController.postCouponCheck);

router.post('/coupon-delete', checkoutController.postCouponDelete);

router.get('/order-confirmation/:orderId', checkoutController.getOrderConfirmation);
router.get('/payment-failed/:orderId', checkoutController.getPaymentFailed);
module.exports = router;
