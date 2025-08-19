const express = require('express');
const router = express.Router();
const paymentController = require('../../controllers/user/user.payment.controller');
router.post('/verify-payment', paymentController.verifyPayment);
router.post('/update-order-status/:orderId', paymentController.updateOrderStatus);
router.post('/create-order', paymentController.createOrder);
router.post('/verify-paymenttwo', paymentController.verifyPaymentTwo);
module.exports = router;
