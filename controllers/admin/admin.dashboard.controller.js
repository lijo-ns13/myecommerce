const path = require('path');
const fs = require('fs');
const Product = require('../../models/productSchema'); // Adjust the path to your Product model
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const PDFDocument = require('pdfkit');
const { getDailyOrderCounts } = require('../../services/orderService');
const SalesReport = require('../../services/salesReport');

// First, define the getDateRange function
function getDateRange(type) {
  const now = new Date();
  let start, end;

  switch (type) {
    case 'daily':
      start = new Date(now.setHours(0, 0, 0, 0)); // Start of today
      end = new Date(now.setHours(23, 59, 59, 999)); // End of today
      break;
    case 'weekly':
      const dayOfWeek = now.getUTCDay(); // Sunday - Saturday : 0 - 6
      start = new Date(now);
      start.setUTCDate(now.getUTCDate() - dayOfWeek); // Set to last Sunday
      start.setUTCHours(0, 0, 0, 0); // Start of the week

      end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6); // End of the week
      end.setUTCHours(23, 59, 59, 999); // End of the last day of the week
      break;
    case 'monthly':
      start = new Date(now.getFullYear(), now.getMonth(), 1); // Start of the month
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); // End of the month
      break;
    case 'yearly':
      start = new Date(now.getFullYear(), 0, 1); // Start of the year
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999); // End of the year
      break;
    default:
      throw new Error('Invalid report type');
  }

  return { start, end };
}

async function generatePdfContent(doc, salesData, orders, type, startDate, endDate) {
  try {
    // Set up document
    doc
      .font('Helvetica-Bold')
      .fontSize(24)
      .fillColor('#1c4587')
      .text('Sales Report', { align: 'center' })
      .moveDown(0.5);

    // Add logo (if exists)
    try {
      const logoPath = path.join(__dirname, '..', 'public', 'images', 'logo.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 50, { width: 50 });
      }
    } catch (logoError) {
      console.warn('Logo not found or could not be loaded:', logoError.message);
    }
    doc.moveDown();

    // Get report title
    const reportTitle = getReportTitle(type, startDate, endDate);
    doc.fontSize(16).fillColor('#666666').text(reportTitle, { align: 'center' }).moveDown();

    // Calculate totals
    let totalSales = salesData.reduce((total, sale) => total + sale.totalSales, 0);
    let totalDiscount = salesData.reduce((total, sale) => total + sale.totalDiscount, 0);
    let totalOrders = salesData.reduce((total, sale) => total + sale.orderCount, 0);
    let averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Add summary section
    doc
      .fontSize(14)
      .fillColor('#1c4587')
      .text('Executive Summary', { underline: true })
      .moveDown(0.5);

    doc.fontSize(12).fillColor('#333333');

    const summaryData = [
      { label: 'Total Revenue', value: `$${totalSales.toFixed(2)}` },
      { label: 'Total Discount', value: `$${totalDiscount.toFixed(2)}` },
      { label: 'Net Revenue', value: `$${(totalSales - totalDiscount).toFixed(2)}` },
      { label: 'Total Orders', value: totalOrders },
      { label: 'Average Order Value', value: `$${averageOrderValue.toFixed(2)}` },
    ];

    const summaryColumnWidth = 200;
    summaryData.forEach((item, index) => {
      doc.text(item.label, 50 + (index % 2) * summaryColumnWidth, doc.y);
      doc.text(item.value, 150 + (index % 2) * summaryColumnWidth, doc.y, { align: 'right' });
      if (index % 2 === 1 || index === summaryData.length - 1) doc.moveDown();
    });

    doc.moveDown();

    // Add sales data table
    doc.addPage();
    doc
      .fontSize(16)
      .fillColor('#1c4587')
      .text('Detailed Sales Statistics', { underline: true })
      .moveDown(0.5);

    // Define table layout
    const tableTop = doc.y;
    const tableHeaders = ['Date', 'Total Sales', 'Total Discount', 'Net Revenue', 'Order Count'];
    const columnWidth = (doc.page.width - 100) / tableHeaders.length;

    // Draw table headers
    drawTableRow(doc, tableTop, tableHeaders, columnWidth, true);
    let tableY = tableTop + 20;

    // Draw table rows
    for (const sale of salesData) {
      if (tableY > doc.page.height - 100) {
        doc.addPage();
        tableY = 50;
        drawTableRow(doc, tableY, tableHeaders, columnWidth, true);
        tableY += 20;
      }

      const netRevenue = sale.totalSales - sale.totalDiscount;
      const rowData = [
        sale._id,
        `$${sale.totalSales.toFixed(2)}`,
        `$${sale.totalDiscount.toFixed(2)}`,
        `$${netRevenue.toFixed(2)}`,
        sale.orderCount.toString(),
      ];

      drawTableRow(doc, tableY, rowData, columnWidth);
      tableY += 20;
    }

    // Add orders table on new page
    doc.addPage();
    doc
      .fontSize(16)
      .fillColor('#1c4587')
      .text('Individual Order Details', { underline: true })
      .moveDown(0.5);

    // Fetch all users
    const users = await User.find({});
    const userMap = users.reduce((map, user) => {
      map[user._id] = user.name;
      return map;
    }, {});

    // Define orders table layout
    const orderHeaders = [
      'Order ID',
      'User Name',
      'Total Price',
      'Discount',
      'Net Price',
      'Order Date',
      'Status',
    ];
    const orderColumnWidth = (doc.page.width - 100) / orderHeaders.length;

    // Draw orders table headers
    let orderTableY = doc.y;
    drawTableRow(doc, orderTableY, orderHeaders, orderColumnWidth, true);
    orderTableY += 20;

    // Draw orders table rows
    for (const order of orders) {
      if (orderTableY > doc.page.height - 100) {
        doc.addPage();
        orderTableY = 50;
        drawTableRow(doc, orderTableY, orderHeaders, orderColumnWidth, true);
        orderTableY += 20;
      }

      const userName = userMap[order.userId] || 'Unknown User';
      const netPrice = order.totalPrice - (order.discount || 0);
      const rowData = [
        order._id.toString().substring(0, 8),
        userName,
        `$${order.totalPrice.toFixed(2)}`,
        `$${order.discount ? order.discount.toFixed(2) : '0.00'}`,
        `$${netPrice.toFixed(2)}`,
        new Date(order.orderDate).toLocaleDateString(),
        order.status,
      ];

      drawTableRow(doc, orderTableY, rowData, orderColumnWidth);
      orderTableY += 20;
    }

    // Add footer
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text(
        `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
        {
          align: 'center',
          bottom: 30,
        }
      );
  } catch (error) {
    console.error('Error generating PDF content:', error);
    doc
      .fontSize(12)
      .fillColor('red')
      .text('An error occurred while generating the report. Please try again later.', 50, 50);
  }
}
function getReportTitle(type, startDate, endDate) {
  const currentDate = new Date();

  switch (type) {
    case 'daily':
      return `Daily Sales Report - ${currentDate.toLocaleDateString()}`;
    case 'weekly':
      return startDate && endDate
        ? `Weekly Sales Report (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`
        : 'Weekly Sales Report';
    case 'monthly':
      const monthName = currentDate.toLocaleString('default', { month: 'long' });
      return `Monthly Sales Report - ${monthName} ${currentDate.getFullYear()}`;
    case 'yearly':
      return `Yearly Sales Report - ${currentDate.getFullYear()}`;
    case 'custom':
      return startDate && endDate
        ? `Custom Sales Report (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`
        : 'Custom Sales Report';
    default:
      return 'Sales Report';
  }
}
const getSalesGraph = async (req, res) => {
  try {
    const { type } = req.query;
    let pipeline = [];
    let groupBy = {};
    let sortBy = {};

    if (type === 'yearly') {
      groupBy = { $year: '$orderDate' };
      sortBy = { _id: 1 };
    } else if (type === 'monthly') {
      groupBy = {
        year: { $year: '$orderDate' },
        month: { $month: '$orderDate' },
      };
      sortBy = { '_id.year': 1, '_id.month': 1 };
    } else if (type === 'weekly') {
      groupBy = {
        year: { $year: '$orderDate' },
        week: { $week: '$orderDate' },
      };
      sortBy = { '_id.year': 1, '_id.week': 1 };
    }

    pipeline = [
      { $match: { status: 'delivered' } },
      {
        $group: {
          _id: groupBy,
          sales: { $sum: '$totalPrice' },
        },
      },
      { $sort: sortBy },
    ];

    const salesData = await Order.aggregate(pipeline);

    // Format the data for the chart
    const formattedData = salesData.map((item) => ({
      name:
        type === 'yearly'
          ? item._id.toString()
          : type === 'monthly'
            ? `${item._id.year}-${item._id.month}`
            : `${item._id.year}-W${item._id.week}`,
      sales: item.sales,
    }));

    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching sales graph data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
const getOrdersCount = async (req, res) => {
  try {
    const { timeUnit, startDate, endDate } = req.query;

    // Validate timeUnit
    const validTimeUnits = ['day', 'month', 'year'];
    if (!validTimeUnits.includes(timeUnit)) {
      return res.status(400).json({ error: 'Invalid time unit' });
    }

    // Validate and parse dates
    let matchStage = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start) || isNaN(end)) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      matchStage = {
        $match: {
          orderDate: {
            $gte: start,
            $lte: end,
          },
        },
      };
    }

    let groupStage = {};
    switch (timeUnit) {
      case 'day':
        groupStage = {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalPrice' },
          },
        };
        break;
      case 'month':
        groupStage = {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalPrice' },
          },
        };
        break;
      case 'year':
        groupStage = {
          $group: {
            _id: { $dateToString: { format: '%Y', date: '$createdAt' } },
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalPrice' },
          },
        };
        break;
    }

    const sortStage = { $sort: { _id: 1 } }; // This can remain unchanged

    const orderCounts = await Order.aggregate([matchStage, groupStage, sortStage]);

    res.json(orderCounts);
  } catch (error) {
    console.error('Error fetching order counts:', error);
    res.status(500).json({ error: 'Error fetching order counts' });
  }
};
const getOrdersStats = async (req, res) => {
  try {
    const orders = await Order.find({});
    console.log('Fetched orders:', orders); // Log all fetched orders
    const statusCounts = {};

    orders.forEach((order) => {
      const status = order.status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('Status Counts:', { statusCounts: statusCounts }); // Log status counts
    res.json({ statusCounts: statusCounts });
  } catch (error) {
    console.error('Error fetching order stats:', error); // Log the error for debugging
    res.status(500).json({ message: 'Error fetching order stats', error });
  }
};
const getDashboard = async (req, res) => {
  try {
    const orders = await Order.find({});
    const customers = await User.find({});

    // for top product,category,brand
    const productcountbybrandcount = await Product.aggregate([
      {
        $group: {
          _id: '$brand',
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
      {
        $limit: 10,
      },
    ]);
    console.log('Product Count by Brand:', productcountbybrandcount);

    const topSellingProducts = await Product.aggregate([
      {
        $sort: {
          orderCount: -1,
        },
      },
      {
        $limit: 10,
      },
      {
        $project: {
          _id: 1,
          product: 1,
          brand: 1,
          category: 1,
          orderCount: 1,
        },
      },
    ]);
    console.log('Product Count by Purchased:', topSellingProducts);
    const topSellingCategories = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          totalSales: { $sum: '$orderCount' }, // Correctly reference with $
        },
      },
      {
        $sort: {
          totalSales: -1,
        },
      },
      {
        $limit: 10,
      },
      {
        $lookup: {
          from: 'categories', // Ensure this is lowercase
          localField: '_id',
          foreignField: '_id',
          as: 'categoryData',
        },
      },
      {
        $unwind: '$categoryData', // Correctly reference here
      },
      {
        $project: {
          _id: 1,
          category: '$categoryData.name', // Correctly reference the unwound field
          totalSales: 1,
        },
      },
    ]);

    console.log('top selling categories', topSellingCategories);
    const topSellingBrands = await Product.aggregate([
      {
        $group: {
          _id: '$brand',
          totalSales: { $sum: '$orderCount' },
        },
      },
      {
        $sort: {
          totalSales: -1,
        },
      },
      {
        $limit: 10,
      },
      {
        $project: {
          brand: 1,
          totalSales: 1,
        },
      },
    ]);

    const ordersCount = orders.filter((order) => order.status === 'delivered').length;
    console.log('Orders Count:', ordersCount);

    let totalDiscount = 0;
    let totalRevenue = 0;
    let customersCount = customers.length;
    for (const order of orders) {
      if (order.status === 'delivered') {
        totalDiscount += order.discount || 0;
        totalRevenue += order.totalPrice || 0;
      }
    }
    res.render('dashboard', {
      ordersCount,
      totalDiscount,
      totalRevenue,
      customersCount,
      topSellingCategories,
      topSellingProducts,
      topSellingBrands,
    });
  } catch (error) {
    console.error('Error fetching orders:', error); // Log the error for debugging
    res.status(500).send('Internal Server Error'); // Send a response in case of error
  }
};
const getSalesReport = async (req, res) => {
  const { type, startDate, endDate } = req.query;

  try {
    let salesData;
    switch (type) {
      case 'daily':
        salesData = await SalesReport.getDailySales();
        break;
      case 'weekly':
        salesData = await SalesReport.getWeeklySales();
        break;
      case 'monthly':
        salesData = await SalesReport.getMonthlySales();
        break;
      case 'yearly':
        salesData = await SalesReport.getYearlySales();
        break;
      case 'custom':
        salesData = await SalesReport.getCustomSales(startDate, endDate);
        break;
      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }

    res.json(salesData);
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
const getSalesReportPDF = async (req, res) => {
  const { type, startDate, endDate } = req.query;

  // Validate that startDate and endDate are present for custom reports
  if (type === 'custom' && (!startDate || !endDate)) {
    return res
      .status(400)
      .json({ message: 'Start date and end date are required for custom reports' });
  }

  // Validate and convert the dates for custom report
  let start = type === 'custom' ? new Date(startDate) : null;
  let end = type === 'custom' ? new Date(endDate) : null;

  // Check if the dates are valid for custom report
  if (type === 'custom' && (isNaN(start.getTime()) || isNaN(end.getTime()))) {
    return res.status(400).json({ message: 'Invalid start date or end date' });
  }

  try {
    let salesData;
    switch (type) {
      case 'daily':
        salesData = await SalesReport.getDailySales();
        break;
      case 'weekly':
        salesData = await SalesReport.getWeeklySales();
        break;
      case 'monthly':
        salesData = await SalesReport.getMonthlySales();
        break;
      case 'yearly':
        salesData = await SalesReport.getYearlySales();
        break;
      case 'custom':
        salesData = await SalesReport.getCustomSales(start, end);
        break;
      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }

    // Fetch orders based on report type
    let orders;
    if (type === 'custom') {
      orders = await Order.find({
        orderDate: {
          $gte: start,
          $lte: end,
        },
      });
    } else {
      const dateRange = getDateRange(type);
      orders = await Order.find({
        orderDate: {
          $gte: dateRange.start,
          $lte: dateRange.end,
        },
      });
    }

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');

    // Pipe the PDF document to the response
    doc.pipe(res);

    // Generate PDF content
    await generatePdfContent(doc, salesData, orders, type, start, end);

    // Finalize PDF file
    doc.end();
  } catch (error) {
    console.error('Error generating PDF report:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
module.exports = {
  getSalesGraph,
  getOrdersCount,
  getOrdersStats,
  getDashboard,
  getSalesReport,
  getSalesReportPDF,
};
