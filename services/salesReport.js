const Order = require('../models/orderSchema'); // Adjust path if necessary

class SalesReport {
    static async getDailySales() {
        const startOfDay = new Date(new Date().setUTCHours(0, 0, 0, 0)); // Start of today in UTC
        return await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: startOfDay },
                    status: 'delivered' // Only include delivered orders
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    totalSales: { $sum: "$totalPrice" },
                    totalDiscount: { $sum: { $ifNull: ["$discount", 0] } },
                    orderCount: { $sum: 1 },
                    orders: {
                        $push: {
                            totalPrice: "$totalPrice",
                            discount: "$discount",
                            status: "$status", // Add other fields as necessary
                            user:'$userId.name',
                            orderId:'$_id'
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);
    }

    static async getWeeklySales() {
        const startOfWeek = new Date();
        startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay()); // Last Sunday
        startOfWeek.setUTCHours(0, 0, 0, 0); // Start of the week in UTC
        
        return await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: startOfWeek },
                    status: 'delivered' // Only include delivered orders
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%U", date: "$orderDate" } },
                    totalSales: { $sum: "$totalPrice" },
                    totalDiscount: { $sum: { $ifNull: ["$discount", 0] } },
                    orderCount: { $sum: 1 },
                    orders: {
                        $push: {
                            totalPrice: "$totalPrice",
                            discount: "$discount",
                            status: "$status", // Add other fields as necessary
                            user:'$userId',
                            orderId:'$_id'

                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);
    }

    static async getMonthlySales() {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); // Start of current month
        return await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: startOfMonth },
                    status: 'delivered' // Only include delivered orders
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$orderDate" } },
                    totalSales: { $sum: "$totalPrice" },
                    totalDiscount: { $sum: { $ifNull: ["$discount", 0] } },
                    orderCount: { $sum: 1 },
                    orders: {
                        $push: {
                            totalPrice: "$totalPrice",
                            discount: "$discount",
                            status: "$status", // Add other fields as necessary
                            user:'$userId',
                            orderId:'$_id'

                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);
    }

    static async getYearlySales() {
        const startOfYear = new Date(new Date().getFullYear(), 0, 1); // Start of current year
        return await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: startOfYear },
                    status: 'delivered' // Only include delivered orders
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y", date: "$orderDate" } },
                    totalSales: { $sum: "$totalPrice" },
                    totalDiscount: { $sum: { $ifNull: ["$discount", 0] } },
                    orderCount: { $sum: 1 },
                    orders: {
                        $push: {
                            totalPrice: "$totalPrice",
                            discount: "$discount",
                            status: "$status", // Add other fields as necessary
                            user:'$userId',
                            orderId:'$_id'

                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);
    }

    static async getCustomSales(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Set the end date to the end of the specified day in UTC
        end.setUTCHours(23, 59, 59, 999);
    
        console.log("Start Date:", start);
        console.log("End Date:", end);
    
        return await Order.aggregate([
            {
                $match: {
                    orderDate: {
                        $gte: start,
                        $lte: end
                    },
                    status: 'delivered' // Only include delivered orders
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    totalSales: { $sum: "$totalPrice" },
                    totalDiscount: { $sum: { $ifNull: ["$discount", 0] } },
                    orderCount: { $sum: 1 },
                    orders: {
                        $push: {
                            totalPrice: "$totalPrice",
                            discount: "$discount",
                            status: "$status", // Add other fields as necessary
                            user:'$userId',
                            orderId:'$_id'
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);
    }
    
}

module.exports = SalesReport;
