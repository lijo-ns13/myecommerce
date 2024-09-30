const mongoose = require('mongoose');
const User = require('./userSchema');
const Product = require('./productSchema');

const { Schema } = mongoose;

const cartSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    products: [
        {
            productId: {
                type: Schema.Types.ObjectId,
                ref: 'Product',
                required: true
            },
            size: {
                type: Number,
                required: true
            },
            quantity: {
                type: Number,
                required: true,
                default: 1
            }
        }
    ],
    totalPrice: {
        type: Number,
        required: true,
        default: 0
    },
    finalPrice: {
        type: Number,
        default: 0
    },
    finalTotalPrice: {
        type: Number,
        default: 0 // Default value set to 0
    },
    status: {
        type: String,
        enum: ['active', 'checked out'],
        default: 'active'
    }
});

cartSchema.pre('save', async function (next) {
    if (this.isModified('products')) {
        try {
            const cart = this;
            let totalPrice = 0;
            let finalTotalPrice = 0;

            // Collect all product IDs and quantities
            const productIds = cart.products.map(p => p.productId);
            const quantities = cart.products.map(p => p.quantity);

            // Fetch products and create a map of prices and final prices
            const products = await Product.find({ _id: { $in: productIds } }).exec();

            // Create a map for product prices and final prices
            const priceMap = new Map();
            const finalPriceMap = new Map();

            products.forEach(product => {
                priceMap.set(product._id.toString(), product.price);
                finalPriceMap.set(product._id.toString(), product.finalPrice || product.price); // Use finalPrice or fallback to price
            });

            // Calculate total price and final total price
            for (let i = 0; i < productIds.length; i++) {
                const productId = productIds[i].toString();
                const quantity = quantities[i];
                const price = priceMap.get(productId);
                const finalPrice = finalPriceMap.get(productId);

                // Calculate total price
                if (price) {
                    totalPrice += price * quantity;
                } else {
                    console.error(`Price not found for product ID: ${productId}`);
                }

                // Calculate final total price based on finalPrice of products
                if (finalPrice) {
                    finalTotalPrice += finalPrice * quantity;
                } else {
                    console.error(`Final price not found for product ID: ${productId}`);
                }
            }

            // Update the cart fields
            cart.totalPrice = totalPrice;
            cart.finalPrice = finalTotalPrice; // You might want to keep this as it is or adjust accordingly
            cart.finalTotalPrice = finalTotalPrice; // Set finalTotalPrice based on product finalPrices
        } catch (error) {
            return next(error);
        }
    }

    next();
});

const Cart = mongoose.model('Cart', cartSchema);
module.exports = Cart;
