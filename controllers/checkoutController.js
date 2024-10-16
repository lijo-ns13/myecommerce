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

const postCheckCatPro=async (req, res) => {
    try {
        const wallet=await Wallet.findOne({userId:req.user._id})
        
        const {paymentMethod}=req.body;
       
        const cart = await Cart.findOne({ userId: req.user._id }).populate('products.productId');
        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart is empty' });
        }
        if(cart.finalPrice>5000 && paymentMethod==='cod'){
            return res.status(400).json({success:false, message: 'Amount greater than 5000 not applicable with COD. Please make the payment online.'})
        }
        if(wallet&&wallet.balance<cart.finalPrice && paymentMethod==='wallet'){
            return res.status(400).json({success:false,message:'Your wallet amount low'})
        }
        for (const product of cart.products) {
            const { productId, size, quantity } = product;
            const productDetails = await Product.findOne({ _id: productId, 'sizes.size': size });
            const categoryId = productDetails.category;
            const checkCategory = await Category.findById(categoryId);

            if (checkCategory.isBlocked) {
                return res.status(400).json({ success: false, message: `We're sorry, but you can't purchase "${productDetails.product}". This category is currently blocked.` });
            }

            if (!productDetails) {
                return res.status(400).json({ success: false, message: `Unfortunately, we couldn't find a product with the ID: ${productId}. Please check and try again.` });
            }

            const sizeDetails = productDetails.sizes.find(s => s.size === size);
            if (!sizeDetails || sizeDetails.stock < quantity) {
                return res.status(400).json({ success: false, message: `Oops! It looks like there isn’t enough stock for "${productDetails.product}" in size "${size}". Available stock: ${sizeDetails ? sizeDetails.stock : 0}. Please adjust your quantity.` });
            }
        }

        res.status(200).json({ success: true, message: 'All products are available' });
    } catch (error) {
        console.error('Error checking category and product availability:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

const postPaymentSuccess= async (req, res) => {
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
}

const postCouponCheck=async (req, res) => {
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
        }

        

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
}
const postCouponDelete=async (req, res) => {
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
            
            await Coupon.updateOne({ _id: coupon._id }, { $inc: { usageLimit: 1 } });
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
}
const getPaymentFailed=async(req,res)=>{
    try {
        const orderId=req.params.orderId;
        const order=await Order.findById(orderId).populate('products.productId');
        if(!order){
            return res.status(400).json({success:false,message:'Order not found'})
        }
        res.status(200).render('order/payment-fail',{order:order})
    } catch (error) {
        res.status(400).json({success:false,message:error.message})
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
    postCheckCatPro,
    postPaymentSuccess,
    postCouponCheck,
    postCouponDelete,
    getPaymentFailed,
    getOrderConfirmation
}