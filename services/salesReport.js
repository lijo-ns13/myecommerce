const Order = require('../models/orderSchema'); // Adjust path if necessary

class SalesReport {
    // Assuming 'delivered' is the status indicating the order has been fulfilled
    static async getDailySales() {
        return await Order.aggregate([
            {
                $match: {
                    orderDate: {
                        $gte: new Date(new Date().setHours(0, 0, 0, 0)) // Start of today
                    },
                    status: 'delivered' // Only include delivered orders
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    totalSales: { $sum: "$totalPrice" },
                    totalDiscount: { $sum: { $ifNull: ["$discount", 0] } },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
    }

    static async getWeeklySales() {
        return await Order.aggregate([
            {
                $match: {
                    orderDate: {
                        $gte: new Date(new Date().setDate(new Date().getDate() - 7)) // Last 7 days
                    },
                    status: 'delivered' // Only include delivered orders
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%U", date: "$orderDate" } },
                    totalSales: { $sum: "$totalPrice" },
                    totalDiscount: { $sum: { $ifNull: ["$discount", 0] } },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
    }

    static async getMonthlySales() {
        return await Order.aggregate([
            {
                $match: {
                    orderDate: {
                        $gte: new Date(new Date().setDate(1)) // Start of current month
                    },
                    status: 'delivered' // Only include delivered orders
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$orderDate" } },
                    totalSales: { $sum: "$totalPrice" },
                    totalDiscount: { $sum: { $ifNull: ["$discount", 0] } },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
    }

    static async getYearlySales() {
        return await Order.aggregate([
            {
                $match: {
                    orderDate: {
                        $gte: new Date(new Date().setFullYear(new Date().getFullYear(), 0, 1)) // Start of current year
                    },
                    status: 'delivered' // Only include delivered orders
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y", date: "$orderDate" } },
                    totalSales: { $sum: "$totalPrice" },
                    totalDiscount: { $sum: { $ifNull: ["$discount", 0] } },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
    }

    static async getCustomSales(startDate, endDate) {
        return await Order.aggregate([
            {
                $match: {
                    orderDate: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    },
                    status: 'delivered' // Only include delivered orders
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    totalSales: { $sum: "$totalPrice" },
                    totalDiscount: { $sum: { $ifNull: ["$discount", 0] } },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
    }
}

module.exports = SalesReport;
