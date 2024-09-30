const express = require('express');
const router = express.Router();
const Order = require('../models/orderSchema');
const Product = require('../models/productSchema');
const Wallet=require('../models/walletSchema');

const getOrders = async (req, res) => {
    try {
        const userId = req.user._id; // Get the logged-in user
        const page = parseInt(req.query.page) || 1; // Current page, default is 1
        const limit = 5; // Number of orders per page
        const skip = (page - 1) * limit; // Calculate how many orders to skip

        // Fetch total number of orders
        const totalOrders = await Order.countDocuments({ userId });

        // Fetch orders for the current page
        const orders = await Order.find({ userId })
            .populate('products.productId')
            .sort({ orderDate: -1 }) // Order by date, newest first
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalOrders / limit);

        // Pass data to the EJS template
        res.render('orders', {
            orders,
            currentPage: page,
            totalPages
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

const postOrderCancel = async (req, res) => { 
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);
        const wallet=await Wallet.findOne({userId:req.user._id})
        
        // Check if order exists
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Check if user is authorized to cancel
        if (order.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Ensure the order can be cancelled
        const cancellableStatuses = ['pending', 'processing'];
        if (!cancellableStatuses.includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Order cannot be cancelled' });
        }

        // Update the order status
        order.status = 'cancelled';
        await order.save();

        // Rebuild stock levels for the products in the order
        const updatedProducts = [];
        for (const item of order.products) {
            const product = await Product.findById(item.productId);

            if (product) {
                
                // Find the size index for the existing size
                const sizeIndex = product.sizes.findIndex(size =>size.size.toString() === item.size.toString());
                
                if (sizeIndex !== -1) {
                    // Update the stock for the existing size
                    product.sizes[sizeIndex].stock += item.quantity;
                } else {
                    // If the size does not exist, this part shouldn't trigger unnecessarily. Just for safety:
                    console.error(`Size ${item.size} not found for product ${item.productId}`);
                    return res.status(400).json({ success: false, message: `Size ${item.size} not found for product` });
                }
                
                await product.save();
                updatedProducts.push({ productId: product._id, size: item.size, newStock: product.sizes[sizeIndex]?.stock });
            }
        }
        const transaction = {
            amount: order.totalPrice,
            type: 'credit',
            description: 'Amount from order canceled',
            date: new Date()
        };
        console.log('trnas',transaction)
        console.log('orderpaymethod',order.paymentDetails.paymentMethod)
        if (order.paymentDetails.paymentMethod === 'razorpay') {

            if (wallet) {
                // Add transaction and update balance if wallet exists
                wallet.balance += order.totalPrice;
                wallet.transactions.push(transaction);
                await wallet.save();
            } else {
                // Create a new wallet if one doesn't exist
                const newWallet = new Wallet({
                    userId: req.user._id,
                    balance: order.totalPrice,
                    transactions: [transaction]  // Ensure this is an array of objects
                });
                await newWallet.save();
            }
            return res.status(200).json({ success: true, message: 'Order cancelled successfully and amount credited to wallet' });
        }
        
        
        res.status(200).json({ success: true, message: 'Order successfully cancelled', updatedProducts });
    } catch (error) {
        console.error('Error during cancellation:', error);
        res.status(400).json({ success: false, message: error.message });
    }
}




module.exports={
    getOrders,
    postOrderCancel
}