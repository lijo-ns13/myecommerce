const express = require('express');

const User = require('../models/userSchema');
const { jwtAuth, userProtected } = require('../middlewares/auth');
const Wishlist = require('../models/wishlistSchema');
const Product = require('../models/productSchema'); // Assuming you have a Product model
const Cart=require('../models/cartSchema')


const getWishlist=async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate({
            path: 'wishlist',
            populate: {
                path: 'products',
                model: 'Product'
            }
        });
        const cart=await Cart.find({});
        console.log('cart',cart)
        
        const cartLength = cart.length > 0 && cart[0].products ? cart[0].products.length : 0;
        console.log('cartLent',cartLength)

        const wishlist = user.wishlist;

        // Check if the wishlist exists and has products
        if (!wishlist || wishlist.length === 0 || !wishlist[0].products.length) {
            return res.render('wishlist', { products: [], message: 'Your wishlist is empty.' });
        }

        res.render('wishlist', { products: wishlist[0].products,cartLength });
    } catch (error) {
        console.error(error); // Log the error for debugging
        res.status(400).json({ success: false, message: error.message });
    }
}
const postAddWishlist=async (req, res) => {
    try {
        const productId = req.params.id;
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(400).json({ success: false, message: 'User not found' });
        }

        // Check if the user already has a wishlist

        let wishlist = await Wishlist.findOne({ userId: req.user._id });
        if (!wishlist) {
            // If the wishlist does not exist, create a new one
            wishlist = new Wishlist({ userId: user._id, products: [] });
            await wishlist.save(); // Save the new wishlist
        }
        if (!wishlist.products.includes(productId)) {
            wishlist.products.push(productId);
            await wishlist.save();
            const product = await Product.findById(productId);
    if (product) {
        product.inWishlist = true;
        await product.save(); // Call save() method with parentheses
    } else {
        return res.status(404).json({ success: false, message: 'Product not found' });
    }
            user.wishlist.push(wishlist._id);
            await user.save(); // Save user only once
            res.status(200).json({ success: true, message: 'Added to wishlist' });
            
          } else {
            return res.status(400).json({ success: true, message: 'Product already in wishlist' });
          }
    } catch (error) {
        console.error(error); // Log the error for debugging
        res.status(400).json({ success: false, message: error.message });
    }
}
const postRemoveWishlist= async (req, res) => {
    try {
        const proWishId = req.params.id;
        console.log('Attempting to delete wishlist item with ID:', proWishId);

        // Find the wishlist entry containing the product to delete
        const wishlist = await Wishlist.findOne({ userId: req.user._id });
        if (!wishlist) {
            return res.status(404).json({ success: false, message: 'Wishlist not found' });
        }
        console.log('wishlist',wishlist)

        // Find the product in the wishlist
        const productIndex = wishlist.products.findIndex(item => item._id.toString() === proWishId);
        console.log('productIndex',productIndex,typeof(productIndex))

        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in wishlist' });
        }

        // Get the productId from the wishlist entry
        const productId = wishlist.products[productIndex];
        console.log('productId',productId)
        // Remove the product from the wishlist
        wishlist.products.splice(productIndex, 1);
        await wishlist.save(); // Save the updated wishlist

        // Change inWishlist property of the product to false
        const product = await Product.findById(productId);
        if (product) {
            product.inWishlist = false;
            await product.save(); // Save the updated product
        } else {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        return res.status(200).json({ success: true, message: 'Product deleted from wishlist' });
    } catch (error) {
        console.error('Error deleting wishlist item:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}



module.exports={
    getWishlist,
    postAddWishlist,
    postRemoveWishlist

}