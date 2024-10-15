const express = require('express');

const Razorpay=require('razorpay')

const User = require('../models/userSchema');
const Cart = require('../models/cartSchema');
const Product = require('../models/productSchema');
const Order = require('../models/orderSchema');
const Address = require('../models/addressSchema');
const Coupon=require('../models/couponSchema');
const Category=require('../models/categorySchema')
const dotenv=require('dotenv').config()
const Wallet=require('../models/walletSchema')
const crypto=require('crypto')

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
        const { paymentMethod, selectedAddress, addressDetails } = req.body;
        
        console.log('Received data:', req.body);
        console.log('paymentMethod:', paymentMethod);

        if (!paymentMethod) {
            return res.status(400).json({ success: false, message: 'Payment method is required' });
        }
        
        
        const cart = await Cart.findOne({ userId }).populate('products.productId');
        // if (!cart || cart.products.length === 0) {
        //     return res.status(400).json({ success: false, message: 'Your cart is empty' });
        // }
        const orderedProducts = [];
        // Validate stock availability for each product in the cart
        for (const product of cart.products) {
            const { productId, size, quantity } = product;
            const productDetails = await Product.findOne({ _id: productId, 'sizes.size': size });
            if (!productDetails) {
                return res.status(400).json({ success: false, message: `Product not found for ID: ${productId}` });
            }

            const sizeDetails = productDetails.sizes.find(s => s.size === size);
            // if (!sizeDetails || sizeDetails.stock < quantity) {
            //     return res.status(400).json({ success: false, message: `Insufficient stock for product ${productDetails.name} in size ${size}. Available stock: ${sizeDetails ? sizeDetails.stock : 0}` });
            // }

            const categoryId = productDetails.category;
            const checkCategory = await Category.findById(categoryId);
            // if (checkCategory.isBlocked) {
            //     return res.status(400).json({ success: false, message: 'Category is blocked' });
            // }
            // If all validations pass, push the ordered product details into the orderedProducts array
            orderedProducts.push({
                productName: productDetails.product,
                productPrice: productDetails.finalPrice,
                productQuantity: quantity,
                productSize: size,
                productId:productDetails._id,
                productImage: productDetails.images[0].secured_url // Assuming there's at least one image
            });
        }
        
        let address;
        if (selectedAddress === 'new') {
            address = new Address({
                user: userId,
                ...addressDetails
            });
            
            await address.save();
            await User.findByIdAndUpdate(userId, { $push: { addresses: address._id } });
        } else {
            address = await Address.findById(selectedAddress);
            if (!address) {
                return res.status(400).json({ success: false, message: 'Invalid address selected' });
            }
        }
        // for push user id to product because of review
        for (const product of cart.products) {
            const productDetails = await Product.findOne({ _id: product.productId });
        
            if (!productDetails) {
                console.log(`Product with ID ${product.productId} not found.`);
                continue; // Skip to the next product if not found
            }
        
            productDetails.orderCount+=product.quantity;
            await productDetails.save()
            const category=await Category.findById(productDetails.category);
            category.orderCount+=product.quantity;
            await category.save();
            if (!productDetails.purchasedByUserIds.includes(userId)) {
                
                productDetails.purchasedByUserIds.push(userId);
                                
                await productDetails.save();
                console.log(`User ${userId} added to purchasedByUserIds for product ${product.productId}`);
            } else {
                console.log(`User ${userId} has already purchased product ${product.productId}`);
            }
        }
        
        const calculateDeliveryDate = (daysToAdd) => {
            const currentDate = new Date();
            currentDate.setDate(currentDate.getDate() + daysToAdd);
            
            // Format the date as MM-DD-YYYY
            const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Months are zero-based
            const day = String(currentDate.getDate()).padStart(2, '0');
            const year = currentDate.getFullYear();
            
            return `${month}-${day}-${year}`;
        };
        
        // Calculate delivery date with 7 days added
        const deliveryDate = calculateDeliveryDate(7);
        const orderData = {
            userId,
            products: cart.products,
            totalPrice: cart.finalPrice,
            shippingAddress: address,
            paymentDetails: {
                paymentMethod,
                transactionId:'11111111111111'
            },
            originalPrice: cart.totalPrice,
            deliveryDate: deliveryDate,
            isDiscount: cart.totalPrice !== cart.finalPrice,
            discount: cart.totalPrice - cart.finalPrice,
            orderedProducts:orderedProducts,
            status: 'pending'
        };
        
        
        if (paymentMethod === 'razorpay') {
            const razorpay = new Razorpay({
                key_id: 'rzp_test_ovddchQMnrblMK',
                key_secret: 'o0wUHZ0m3cvfpcgmhLx3N4UL'
            });
        
            const options = {
                amount: cart.finalPrice * 100, // amount in paise
                currency: 'INR',
                receipt: `receipt_order_${new Date().getTime()}`,
            };
        
            const order = await razorpay.orders.create(options);
            if (!order) {
                return res.status(400).json({success:false,message:'some issues in razorpay order'})
            }
        
            const newOrder = new Order({
                ...orderData,
                status: 'pending',
                razorpayOrderId: order.id // save the Razorpay order ID
            });
            await newOrder.save();
            // Generate a hashed transaction ID and take a substring of it
            const hash = crypto.createHash('sha256').update(newOrder._id.toString()).digest('hex');
            const shortTransactionId = hash.substring(0, 10); // Take the first 10 characters or adjust as needed
            newOrder.paymentDetails.transactionId = shortTransactionId;
            await newOrder.save()
            console.log('Sending response:', {
                success: true,
                orderId: newOrder._id,
                razorpayOrderId: order.id,
                amount: order.amount,
            });
            // Update stock and clear cart
            for (const product of cart.products) {
                await Product.findOneAndUpdate(
                    { _id: product.productId, 'sizes.size': product.size },
                    { $inc: { 'sizes.$.stock': -product.quantity } }
                );
            }
            await Cart.deleteOne({ userId });
            return res.json({
                success: true,
                orderId: newOrder._id,
                razorpayOrderId: order.id, // Return Razorpay order ID to client
                amount: order.amount, // Return order amount
            });
        }
        else if (paymentMethod === 'cod') {
            
            const newOrder = new Order(orderData);
            await newOrder.save();
            
            // Generate a hashed transaction ID and take a substring of it
        const hash = crypto.createHash('sha256').update(newOrder._id.toString()).digest('hex');
        const shortTransactionId = hash.substring(0, 10); // Take the first 10 characters or adjust as needed
        newOrder.paymentDetails.transactionId = shortTransactionId;
            await newOrder.save()
            // Update stock and clear cart
            for (const product of cart.products) {
                await Product.findOneAndUpdate(
                    { _id: product.productId, 'sizes.size': product.size },
                    { $inc: { 'sizes.$.stock': -product.quantity } }
                );
            }
            await Cart.deleteOne({ userId });

            return res.status(200).json({
                success: true,
                orderId: newOrder._id,
                amount: newOrder.totalPrice,
            });
        } else if(paymentMethod==='wallet'){
            const userWallet=await Wallet.findOne({userId:req.user._id});
            
            const newOrder = new Order(orderData);

            await newOrder.save();
            // Generate a hashed transaction ID and take a substring of it
        const hash = crypto.createHash('sha256').update(newOrder._id.toString()).digest('hex');
        const shortTransactionId = hash.substring(0, 10); // Take the first 10 characters or adjust as needed
        newOrder.paymentDetails.transactionId = shortTransactionId;
            await newOrder.save()
            // Update stock and clear cart
            for (const product of cart.products) {
                await Product.findOneAndUpdate(
                    { _id: product.productId, 'sizes.size': product.size },
                    { $inc: { 'sizes.$.stock': -product.quantity } }
                );
            }
            userWallet.balance-=cart.finalPrice;
            transaction={
                amount:cart.finalPrice,
                type:'debit',
                description:'amount debited',
                date:new Date()
            };
            userWallet.transactions.push(transaction)
            await userWallet.save()
            await Cart.deleteOne({ userId });
            
            
            
            return res.status(200).json({
                success: true,
                orderId: newOrder._id,
                amount: newOrder.totalPrice,
            });
        }
        else {
            return res.status(400).json({ success: false, message: 'Invalid payment method' });
        }
        
    } catch (error) {
        console.error('Error processing order:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};


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