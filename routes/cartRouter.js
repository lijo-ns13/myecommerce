const express = require('express');
const router = express.Router();
const Product = require('../models/productSchema');
const Cart = require('../models/cartSchema');
const { jwtAuth, userProtected } = require('../middlewares/auth');
const cartController = require('../controllers/cartController');

router.use(jwtAuth, userProtected);
router.get('/', cartController.getCart);
router.post('/add', cartController.postAddCart);
router.post('/delete/:id', cartController.postDeleteCart);
router.post('/updateQuantity/:productId/:size', cartController.postUpdateQuantity);

module.exports = router;
