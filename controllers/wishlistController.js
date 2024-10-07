const express = require('express');

const User = require('../models/userSchema');
const { jwtAuth, userProtected } = require('../middlewares/auth');
const Wishlist = require('../models/wishlistSchema');
const Product = require('../models/productSchema'); // Assuming you have a Product model
const Cart = require('../models/cartSchema');

const getWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).populate('wishlist');
        console.log('users',user)
        if (!user.wishlist || user.wishlist.length === 0) {
            console.log('user wishlist empty')
            return res.render('wishlist', { products: [], message: 'Your wishlist is empty.' });
        }

        const wishlistProducts = await Product.find({ _id: { $in: user.wishlist } });

        const productsWithWishlistFlag = wishlistProducts.map(product => ({
            ...product.toObject(),
            inWishlist: true // All products here are in the wishlist
        }));
        console.log('produclkja;sdf',productsWithWishlistFlag)

        res.render('wishlist', { products: productsWithWishlistFlag });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        res.status(500).json({ success: false, message: 'Error fetching wishlist.' });
    }
};



module.exports = {
    getWishlist
}
