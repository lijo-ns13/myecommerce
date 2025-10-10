const express = require('express');
const router = express.Router();

const { jwtAuth, userProtected, checkBlockedUser } = require('../../middlewares/auth');
const checkoutController = require('../../controllers/user/user.checkout.controller');
router.use(jwtAuth, userProtected, checkBlockedUser);

router.get('/', checkoutController.getCheckout);
router.post('/', checkoutController.postCheckout);

router.post('/checkcatpro', checkoutController.postCheckCatPro);

// Route to handle payment success
router.post('/payment-success', checkoutController.postPaymentSuccess);

router.post('/coupon-check', checkoutController.postCouponCheck);

router.post('/coupon-delete', checkoutController.postCouponDelete);

router.get('/order-confirmation/:orderId', checkoutController.getOrderConfirmation);
router.get('/payment-failed/:orderId', checkoutController.getPaymentFailed);
module.exports = router;
