const express = require('express');
const router = express.Router();
const Order = require('../models/orderSchema');
const Product = require('../models/productSchema');
const { jwtAuth, userProtected } = require('../middlewares/auth');
const orderController=require('../controllers/orderController');

// Apply JWT authentication and protect the routes
router.use(jwtAuth, userProtected);

// Route to get the list of orders for a user
router.get('/',orderController.getOrders);

// Route to cancel an order
router.post('/:orderId/cancel', orderController.postOrderCancel);

module.exports = router;
