const express = require('express');
const router = express.Router();
const Review = require('../models/reviewSchema'); // Adjust the path as necessary
const Order = require('../models/orderSchema'); // Use "Order" for clarity
const Product = require('../models/productSchema'); // Adjust the path as necessary
const Products=require('../models/productSchema')
const { jwtAuth, userProtected } = require('../middlewares/auth');

// Apply JWT and user protection middleware
router.use(jwtAuth, userProtected);

// Create a new review
router.post('/', async (req, res) => {
    try {
        const { rating, comment, productId } = req.body;
        const userId = req.user ? req.user._id : null;

        console.log('Incoming Data:', { rating, comment, productId, userId });

        // Validate input
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Please log in to leave a review.' });
        }
        if (!rating || !comment || !productId) {
            return res.status(400).json({ success: false, message: 'Rating, comment, and product ID are required.' });
        }

        // Create new review object
        const newReview = new Review({
            product: productId,
            user: userId,
            rating,
            comment,
            createdAt: new Date()
        });

        // Save review to the database
        const review = await newReview.save();

        console.log('Review Created:', review);

        // Optionally, update the product with the new review
        await Products.findByIdAndUpdate(productId, { $push: { reviews: review._id } });

        // Return the created review
        res.status(201).json({ success: true, review });
    } catch (error) {
        console.log('Error on review adding:', error.message);
        res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = router;
