const Order = require('../models/orderSchema');

async function getDailyOrderCounts() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    try {
        const results = await Order.aggregate([
            {
                $match: {
                    orderDate: {
                        $gte: startOfDay,
                        $lt: endOfDay
                    }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 } // Sort by date ascending
            }
        ]);

        // Convert results to an array of counts
        return results.map(result => result.count);
    } catch (error) {
        console.error('Error fetching daily order counts:', error);
        throw error; // Rethrow to handle at the API level
    }
}

module.exports = { getDailyOrderCounts };
