const mongoose = require('mongoose');
const { Schema } = mongoose;
const Product = require('./productSchema');
const User = require('./userSchema');

const reviewSchema = new Schema({
    product: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    user: {
        type: Schema.Types.ObjectId, 
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true,
        minlength: [10, "Minimum length is 10 characters"]
    },
    date: {
        type: Date,
        default: Date.now
    },
    isDeleted: {                       // Optional: For soft delete functionality
        type: Boolean,
        default: false
    }
});

const Review = mongoose.model('Review', reviewSchema); // Fixed typo here
module.exports = Review;
