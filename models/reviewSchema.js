const mongoose=require('mongoose');
const {Schema}=mongoose;
const Product=require('./productSchema');
const User=require('./userSchema');
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
        minLength: [10, "Minimum length is 10 characters"]
    },
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports=mongoose.model('Reivew',reviewSchema);