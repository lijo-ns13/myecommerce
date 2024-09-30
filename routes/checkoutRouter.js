const express = require('express');
const router = express.Router();

const razorpay = require('razorpay');
const crypto = require('crypto');

const { jwtAuth, userProtected } = require('../middlewares/auth');

const User = require('../models/userSchema');
const Cart = require('../models/cartSchema');
const Product = require('../models/productSchema');
const Order = require('../models/orderSchema');
const Address = require('../models/addressSchema');
const Coupon=require('../models/couponSchema')
const checkoutController=require('../controllers/checkoutController')

router.use(jwtAuth, userProtected);

router.get('/', checkoutController.getCheckout);
router.post('/', checkoutController.postCheckout);


// Razorpay instance initialization (put your Razorpay keys here)
const razorpayInstance = new razorpay({
    key_id: 'rzp_test_HcIqECgcTGh7Na',
    key_secret: '0oJyfx0TqcxmRsgNKTq9o05M',
});

// Route to handle payment success
router.post('/payment-success', async (req, res) => {
    try {
        console.log('page commed in payment-success')
        const { razorpay_payment_id, selectedAddress, totalPrice, coupon } = req.body;

        // Optional: Verify the payment on server side
        const payment = await razorpayInstance.payments.fetch(razorpay_payment_id);
        if (payment.status !== 'captured') {
            return res.status(400).send('Payment not captured');
        }
        const cart=await Cart.find({userId:req.user._id});
        // Create and save the order
        const newOrder = new Order({
            userId: req.user._id, // Assuming you're using authentication
            products: cart.products, // Products from the cart
            totalPrice: totalPrice,
            shippingAddress: selectedAddress, // If new address, handle it accordingly
            paymentDetails: {
                paymentMethod: 'Razorpay',
                transactionId: razorpay_payment_id
            },
            status: 'pending', // Initial order status
            couponCode: coupon ? coupon : null, // If coupon applied
            orderDate: new Date()
        });

        await newOrder.save();

        // Clear the cart after successful order
        // req.session.cart = null;
        
        cart=null;

        // Send success response
        res.status(200).send('Order placed successfully!');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error processing payment');
    }
});
router.post('/coupon-check', async (req, res) => {
    try {
        const { couponCode } = req.body;

        // Ensure the user is logged in
        if (!req.user || !req.user._id) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        // Fetch coupon details
        const coupon = await Coupon.findOne({ couponCode: couponCode });
        if (!coupon) {
            return res.status(400).json({ success: false, message: 'Invalid coupon' });
        }

        // Check if the coupon is active
        const currentDate = new Date();
        if (currentDate < coupon.startDate || currentDate > coupon.endDate) {
            return res.status(400).json({ success: false, message: 'Coupon is expired or not valid yet' });
        }

        // Check if the usage limit is exceeded
        if (coupon.usageLimit <= 0) {
            return res.status(400).json({ success: false, message: 'Coupon usage limit exceeded' });
        }

        // Fetch the cart and check if it exists and has products
        const cart = await Cart.findOne({ userId: req.user._id });
        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        // Calculate total price of the cart
        let totalPrice = 0;
        for (const product of cart.products) {
            const productDetails = await Product.findById(product.productId);
            if (!productDetails) {
                return res.status(400).json({ success: false, message: 'Product not found in the cart' });
            }
            totalPrice += productDetails.finalPrice * product.quantity;
        }

        // Ensure the total price meets the minimum purchase amount
        if (totalPrice < coupon.minPurchaseAmount) {
            return res.status(400).json({ success: false, message: `Minimum purchase amount for this coupon is ${coupon.minPurchaseAmount}` });
        }
if (coupon.usedUsers.includes(req.user._id)) {
            return res.status(400).json({ success: false, message: 'Coupon has already been used by this user' });
        }
        // Calculate discount
        let discount = 0;
        let discountPercentage = 0;

        if (coupon.discountType === 'percentage') {
            discountPercentage = coupon.discountValue;
            discount = (coupon.discountValue / 100) * totalPrice;
        } else {
            discount = coupon.discountValue;
            discountPercentage = (discount / totalPrice) * 100;  // Convert fixed discount to percentage for display
        }

        // Ensure discount does not exceed the maximum allowed discount
        discount = Math.min(discount, coupon.maxDiscount);

        // Apply the discount to the total price
        const finalPrice = totalPrice - discount;

        // Prevent final price from being negative
        const adjustedFinalPrice = Math.max(finalPrice, 0);
        req.session.couponCode=couponCode;
        cart.finalPrice = adjustedFinalPrice;
        await cart.save();
        req.session.finalPrice = cart.finalPrice;
        if (!coupon.usedUsers.includes(req.user._id)) {
            coupon.usedUsers.push(req.user._id);
            await coupon.save()
        } else {
            return res.status(400).json({ message: 'Coupon has already been used by this user' });
        }
        // Send the response with the discounted price and percentage
        res.status(200).json({
            success: true,
            message: 'Coupon applied successfully',
            totalPrice: adjustedFinalPrice,
            discount: discount,
            originalPrice: totalPrice,
            discountPercentage: Math.round(discountPercentage * 100) / 100
        });

        // Update coupon usage limit if applicable
        await Coupon.updateOne({ _id: coupon._id }, { $inc: { usageLimit: -1 } });

    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.post('/coupon-delete', async (req, res) => {
    try {
        // Find the cart for the logged-in user
        const cart = await Cart.findOne({ userId: req.user._id });

        if (cart) {
            // Reset the finalPrice to the totalPrice
            cart.finalPrice = cart.finalTotalPrice;
            await cart.save();
            req.session.finalPrice=cart.finalPrice;
            const couponCode=req.session.couponCode; // Assuming couponCode is sent in the request body
            const coupon = await Coupon.findOne({ couponCode:couponCode });

            if (coupon) {
                // Remove the user ID from the usedUsers array
                const userIndex = coupon.usedUsers.indexOf(req.user._id);
                if (userIndex > -1) {
                    coupon.usedUsers.splice(userIndex, 1); // Remove user ID
                    await coupon.save(); // Save the updated coupon
                } else {
                    return res.status(400).json({ message: 'User ID not found in used users.' });
                }
            } else {
                return res.status(404).json({ message: 'Coupon not found.' });
            }
            // Respond with success
            res.status(200).json({ message: 'Coupon deleted and final price updated.' });
        } else {
            // If no cart is found, send an error message
            res.status(404).json({ message: 'Cart not found.' });
        }
    } catch (error) {
        // Handle any errors
        console.error(error);
        res.status(500).json({ message: 'An error occurred while deleting the coupon.' });
    }
});

router.get('/order-confirmation/:orderId', checkoutController.getOrderConfirmation);

module.exports = router;




