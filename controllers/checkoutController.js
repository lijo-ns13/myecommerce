const express = require('express');

const Razorpay=require('razorpay')

const User = require('../models/userSchema');
const Cart = require('../models/cartSchema');
const Product = require('../models/productSchema');
const Order = require('../models/orderSchema');
const Address = require('../models/addressSchema');
const Coupon=require('../models/couponSchema')
const getCheckout = async (req, res) => {
    try {
        const userId = req.user._id; // Assuming user is authenticated and user ID is available from the session or JWT

        // Fetch cart details for the user
        const cart = await Cart.findOne({ userId }).populate('products.productId');
        if (!cart || cart.products.length === 0) {
            return res.redirect('/cart'); // Redirect to cart if it's empty
        }

        // Fetch user details and addresses
        const user = await User.findById(userId).populate('address');
        if (!user) {
            return res.redirect('/auth/signin'); // Redirect to sign-in if user is not found
        }

        // Calculate total price
        let totalPrice = 0;
        cart.products.forEach(item => {
            totalPrice += item.productId.finalPrice * item.quantity; // Assuming price is a field in product
        });

        

        // Render the checkout page with cart, user data, and total price
        res.render('checkout', {
            cart,
            user,
            totalPrice// Pass totalPrice to the EJS view
        });
    } catch (error) {
        console.error('Error fetching checkout data:', error);
        res.status(500).send('Something went wrong. Please try again later.');
    }
};


const postCheckout = async (req, res) => {
    try {
        const userId = req.user._id;
        const { selectedAddress, newStreet, newCity, newState, newPostalCode, newCountry, newPhoneNo, paymentMethod,  } = req.body;
        
        console.log('paymentMethod:', paymentMethod);
        const cart = await Cart.findOne({ userId });
        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart is empty' });
        }

        // Validate stock availability for each product in the cart
        for (const product of cart.products) {
            const { productId, size, quantity } = product;
            const productDetails = await Product.findOne({ _id: productId, 'sizes.size': size });

            if (!productDetails) {
                // return res.status(400).json({ success: false, message: `Product not found for ID: ${productId}` });
                return res.status(400).redirect('/cart')
            }

            const sizeDetails = productDetails.sizes.find(s => s.size === size);
            if (!sizeDetails || sizeDetails.stock < quantity) {
                // return res.status(400).json({ success: false, message: `Insufficient stock for product ${productDetails.name} in size ${size}. Available stock: ${sizeDetails ? sizeDetails.stock : 0}` });
                return res.status(400).redirect('/cart')
            }
        }

        // Calculate totalPrice based on cart products
        // for (const product of cart.products) {
        //     const productDetails = await Product.findById(product.productId); // Fetch product details
        //     if (productDetails) {
        //         totalPrice += productDetails.price * product.quantity; // Assuming price is per unit
        //     }
        // }
      
        
        let address;
        if (selectedAddress === 'new') {
            // Validate new address inputs
            // (Address validation code remains the same)

            // Add new address to user's address list
            address = new Address({
                user: userId,
                street: newStreet,
                city: newCity,
                state: newState,
                postalCode: newPostalCode,
                country: newCountry,
                phoneNo: newPhoneNo 
            });
            
            await address.save();
            await User.findByIdAndUpdate(userId, { $push: { addresses: address._id } }); // Add new address to user's address list
        } else {
            address = await Address.findById(selectedAddress);
            if (!address) {
                return res.status(400).json({ success: false, message: 'Invalid address selected' });
            }
        }

        // Delivery date calculation function
        function calculateDeliveryDate() {
            const deliveryTime = 7; 
            const now = new Date();
            return new Date(now.setDate(now.getDate() + deliveryTime));
        }

        let payDetails = {
            paymentMethod: '',
            transactionId: ''
        };

        const razorpay = new Razorpay({
            key_id: 'rzp_test_HcIqECgcTGh7Na',
            key_secret: '0oJyfx0TqcxmRsgNKTq9o05M'
        });
        function generateTransactionId() {
            const timestamp = Date.now(); // Get current timestamp
            const randomNum = Math.floor(Math.random() * 1000000); // Generate a random number
            return `COD-${timestamp}-${randomNum}`; // Format transaction ID
        }
        if (paymentMethod === 'razorpay') {
            payDetails.paymentMethod = paymentMethod;
        
            const options = {
                amount: cart.finalTotalPrice * 100, // Amount in paise
                currency: 'INR',
                receipt: `receipt_order_${new Date().getTime()}`,
            };
        
            const order = await razorpay.orders.create(options);
            payDetails.transactionId = order.id;
        
            console.log('Creating Razorpay order with total amount:', cart.finalPrice );
        
            const newOnlineOrder=new Order({
                userId:req.user._id,
                totalPrice:cart.finalPrice,
                shippingAddress:address,
                deliveryDate:calculateDeliveryDate(),
                status:'pending',
                paymentDetails:payDetails,
                originalPrice:cart.totalPrice,
                products:cart.products,
                isDiscount:cart.totalPrice !== cart.finalPrice,
                discount:cart.totalPrice - cart.finalPrice
            })
            await newOnlineOrder.save();
            await Cart.findByIdAndDelete(cart._id)
            // return res.status(200).json({
            //     success:true,
            //     message:'Order created successfully from razy'
            // })
            return res.redirect(`/checkout/order-confirmation/${newOnlineOrder._id}`);
            
            // return res.json({
            //     success: true,
            //     orderId: order.id,
            //     amount: order.amount,
            //     currency: order.currency,
            //     key: razorpay.key_id,
                
            // });
        } else {
            payDetails.paymentMethod = 'cod';
            payDetails.transactionId= generateTransactionId();
        }

        // Create new order
        const newOrder = new Order({
            userId,
            products: cart.products,
            totalPrice:cart.finalPrice, // This is the total price after applying any discounts
            shippingAddress: address,
            paymentDetails: payDetails,
            originalPrice:cart.totalPrice,
            deliveryDate: calculateDeliveryDate(),
            isDiscount:cart.totalPrice !== cart.finalPrice,
            discount:cart.totalPrice - cart.finalPrice
        });

        await newOrder.save();
        await User.findByIdAndUpdate(userId, { $push: { orders: newOrder._id } });
        await Cart.deleteOne({ userId });

        // Update stock for products
        for (const product of cart.products) {
            const { productId, size, quantity } = product;
            await Product.findOneAndUpdate(
                { _id: productId, 'sizes.size': size },
                { $inc: { 'sizes.$.stock': -quantity } }
            );
        }

        if (paymentMethod === 'cod') {
            return res.redirect(`/checkout/order-confirmation/${newOrder._id}`);
        }
        
    } catch (error) {
        console.error('Error processing order:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}

const getOrderConfirmation=async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).send('Order not found');
        }
        req.session.couponData = null; 
        
        // res.status(200).json({success:true})
        res.render('order/order-confirmation', {
            order
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).send('Something went wrong. Please try again later.');
    }
}

module.exports={
    getCheckout,
    postCheckout,
    getOrderConfirmation
}