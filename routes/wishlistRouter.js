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
router.post('/add/:productId', async (req, res) => {
    try {
        const productId = req.params.productId;
        const userId = req.user._id;

        const user = await User.findById(userId);
        if(user.wishlist.includes(productId)){
            return res.status(400).json({ message: "Product already in wishlist" });
        }
        if (!user.wishlist.includes(productId)) {
            user.wishlist.push(productId);
            await user.save();
        }

        return res.json({ success: true, message: 'Added to wishlist!' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Error adding to wishlist.' });
    }
});

// Remove from wishlist
router.post('/remove/:productId', async (req, res) => {
    try {
        const productId = req.params.productId;
        const userId = req.user._id;

        const user = await User.findById(userId);
        user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
        await user.save();

        return res.json({ success: true, message: 'Removed from wishlist!' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Error removing from wishlist.' });
    }
});
module.exports = router;

