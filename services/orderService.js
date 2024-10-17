// controllers/orderController.js
const Order = require('../models/orderSchema');

// Get orders based on time period
const getOrdersByTimePeriod = async (req, res) => {
    const { period } = req.params; // 'daily', 'weekly', 'monthly', 'yearly'

    let startDate;
    const endDate = new Date();

    switch (period) {
        case 'daily':
            startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - 1);
            break;
        case 'weekly':
            startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - 7);
            break;
        case 'monthly':
            startDate = new Date(endDate);
            startDate.setMonth(endDate.getMonth() - 1);
            break;
        case 'yearly':
            startDate = new Date(endDate);
            startDate.setFullYear(endDate.getFullYear() - 1);
            break;
        default:
            return res.status(400).json({ message: 'Invalid period' });
    }

    try {
        const orders = await Order.find({
            orderDate: { $gte: startDate, $lte: endDate },
        });

        const labels = orders.map(order => new Date(order.orderDate).toLocaleDateString());
        const data = orders.map(order => order.totalPrice);

        return res.render('orderChart', {
            labels,
            data,
            period,
            totalOrders: orders.length,
            totalRevenue: orders.reduce((acc, order) => acc + order.totalPrice, 0),
        });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error });
    }
};

module.exports = { getOrdersByTimePeriod };

