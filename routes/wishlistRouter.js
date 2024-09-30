const express = require('express');
const router = express.Router();
const User = require('../models/userSchema');
const { jwtAuth, userProtected } = require('../middlewares/auth');
const Wishlist = require('../models/wishlistSchema');
const Product = require('../models/productSchema'); // Assuming you have a Product model
const Cart=require('../models/cartSchema')
const wishlistController=require('../controllers/wishlistController')
// Middleware for authentication
router.use(jwtAuth, userProtected);

router.get('/', wishlistController.getWishlist);


// Add product to wishlist
router.post('/add/:id', wishlistController.postAddWishlist);
router.post('/remove/:id', wishlistController.postRemoveWishlist);


module.exports = router;

