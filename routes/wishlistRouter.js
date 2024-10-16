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


// Add to wishlist
router.post('/add/:productId', wishlistController.postWishlistAdd);

// Remove from wishlist
router.post('/remove/:productId', wishlistController.postRemoveWishlist);
module.exports = router;

