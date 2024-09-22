const express = require('express');
const router = express.Router();

const { jwtAuth, userProtected } = require('../middlewares/auth');

const User = require('../models/userSchema');
const Cart = require('../models/cartSchema');
const Product = require('../models/productSchema');
const Order = require('../models/orderSchema');
const Address = require('../models/addressSchema');

const checkoutController=require('../controllers/checkoutController')

router.use(jwtAuth, userProtected);

router.get('/', checkoutController.getCheckout);
router.post('/', checkoutController.postCheckout);


router.get('/order-confirmation/:orderId', checkoutController.getOrderConfirmation);

module.exports = router;



