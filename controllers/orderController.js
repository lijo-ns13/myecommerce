const express = require('express');
const router = express.Router();
const Order = require('../models/orderSchema');
const Product = require('../models/productSchema');


const getOrders=async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user._id }).populate('products.productId');
        res.render('orders', { orders }); // Render orders on the page
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
}
const postOrderCancel = async (req, res) => { 
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);

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