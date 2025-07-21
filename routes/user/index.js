const express = require('express');
const router = express.Router();
const userAddressRouter = require('./user.address.routes');
const userCartRouter = require('./user.cart.routes');
const userCheckoutRouter = require('./user.checkout.routes');
const userGoogleRouter = require('./user.googleauth.routes');
const userOrderRouter = require('./user.order.routes');
const userPaymentRouter = require('./user.payment.routes');
const userProfileRouter = require('./user.profile.routes');
const userReviewRouter = require('./user.review.routes');
const userWishlistRouter = require('./user.wishlist.routes');

router.use('/address', userAddressRouter);
router.use('/cart', userCartRouter);
router.use('/checkout', userCheckoutRouter);
// google auth here i will call later
router.use('/order', userOrderRouter);
router.use('/payment', userPaymentRouter);
router.use('/profile', userProfileRouter);
router.use('/review', userReviewRouter);
router.use('/wishlist', userWishlistRouter);
module.exports = router;
