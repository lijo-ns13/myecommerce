const express = require('express');
const router = express.Router();
const User = require('../models/userSchema');
const { jwtAuth, userProtected } = require('../middlewares/auth');
const Wishlist = require('../models/wishlistSchema');
const Product = require('../models/productSchema'); // Assuming you have a Product model

// Middleware for authentication
router.use(jwtAuth, userProtected);

router.get('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate({
            path: 'wishlist',
            populate: {
                path: 'products',
                model: 'Product'
            }
        });

        const wishlist = user.wishlist;

        // Check if the wishlist exists and has products
        if (!wishlist || wishlist.length === 0 || !wishlist[0].products.length) {
            return res.render('wishlist', { products: [], message: 'Your wishlist is empty.' });
        }

        res.render('wishlist', { products: wishlist[0].products });
    } catch (error) {
        console.error(error); // Log the error for debugging
        res.status(400).json({ success: false, message: error.message });
    }
});


// Add product to wishlist
router.post('/add/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(400).json({ success: false, message: 'User not found' });
        }

        // Check if the user already has a wishlist
        let wishlist = await Wishlist.findOne({ userId: req.user._id });
        if (!wishlist) {
            // Create a new wishlist if it doesn't exist
            wishlist = new Wishlist({ userId: req.user._id });
            await wishlist.save();

            // Add the new wishlist to the user's wishlist array
            user.wishlist.push(wishlist._id);
            await user.save();
        }

        // Check if the product is already in the wishlist
        if (!wishlist.products.includes(productId)) {
            wishlist.products.push(productId);
            await wishlist.save();
            user.wishlist.push(wishlist._id);
            await user.save()
            res.status(200).json({ success: true, message: 'Added to wishlist' });
        } else {
            return res.status(400).json({ success: true, message: 'Product already in wishlist' });
        }
    } catch (error) {
        console.error(error); // Log the error for debugging
        res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = router;

