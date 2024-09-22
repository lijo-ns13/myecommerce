const express = require('express');



const User = require('../models/userSchema');
const Cart = require('../models/cartSchema');
const Product = require('../models/productSchema');
const Order = require('../models/orderSchema');
const Address = require('../models/addressSchema');

const getCheckout=async (req, res) => {
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

        // Render the checkout page with cart and user data
        res.render('checkout', {
            cart,
            user
        });
    } catch (error) {
        console.error('Error fetching checkout data:', error);
        res.status(500).send('Something went wrong. Please try again later.');
    }
}

const postCheckout=async (req, res) => {
    try {
        const userId = req.user._id;
        const { selectedAddress, newStreet, newCity, newState, newPostalCode, newCountry, newPhoneNo, paymentMethod } = req.body;
        console.log('paymentMethod:',paymentMethod)
        const cart = await Cart.findOne({ userId });
        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart is empty' });
        }
        const user=await User.findById(req.user._id)
        const streetRegex=/^[a-zA-Z0-9\s.,'-]{2,100}$/
        const cityRegex=/^[a-zA-Z\s.'-]{2,50}$/;
        const stateRegex=/^[a-zA-Z\s'-]{2,50}$/;
        const postalCodeRegex=/^[a-zA-Z0-9\s-]{3,12}$/;
        const countryRegex=/^[a-zA-Z\s'-]{2,50}$/;
        const phoneNoRegex=/^\+?[1-9]\d{1,14}$|^[0-9]{10,15}$/;
        
        

        const totalPrice = cart.totalPrice;

        let address;
        if (selectedAddress === 'new') {
            if(!newStreet || !newCity || !newState || !newPostalCode || !newCountry || !newPhoneNo){
                return res.status(400).json({ success: false, message: 'Please fill all the'})
            }
            if (!streetRegex.test(newStreet)) {
                return res.status(400).json({ success: false, message: 'Invalid Street Name' });
            }
            if (!cityRegex.test(newCity)) {
                return res.status(400).json({ success: false, message: 'Invalid City Name' });
            }
            if (!stateRegex.test(newState)) {
                return res.status(400).json({ success: false, message: 'Invalid State Name' });
            }
            if (!postalCodeRegex.test(newPostalCode)) {
                return res.status(400).json({ success: false, message: 'Invalid Postal Code' });
            }
            if (!countryRegex.test(newCountry)) {
                return res.status(400).json({ success: false, message: 'Invalid Country Name' });
            }
            if (!phoneNoRegex.test(newPhoneNo)) {
                return res.status(400).json({ success: false, message: 'Invalid Phone Number' });
            }
            // Add new address to user's address list
            address = new Address({
                user:userId,
                street: newStreet,
                city: newCity,
                state: newState,
                postalCode: newPostalCode,
                country: newCountry,
                phoneNo: newPhoneNo 
            });
            await address.save();
            user.address.push(address._id);
            await user.save();
        } else {
            address = await Address.findById(selectedAddress);
            if (!address) {
                return res.status(400).json({ success: false, message: 'Invalid address selected' });
            }
        }

        function calculateDeliveryDate() {
            const deliveryTime = 7; 
            const now = new Date();
            const deliveryDate = new Date(now.setDate(now.getDate() + deliveryTime));
            return deliveryDate;
        }

        const newOrder = new Order({
            userId,
            products: cart.products,
            totalPrice,
            shippingAddress: address,
            paymentMethod:paymentMethod,
            deliveryDate: calculateDeliveryDate()
        });

        await newOrder.save();
        await Cart.deleteOne({ userId });

        for (const product of cart.products) {
            const { productId, size, quantity } = product;
            await Product.findOneAndUpdate(
                { _id: productId, 'sizes.size': size },
                { $inc: { 'sizes.$.stock': -quantity } }
            );
        }

        res.redirect(`/checkout/order-confirmation/${newOrder._id}`);
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