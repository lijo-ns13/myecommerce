const path = require('path');
const fs = require('fs');
const Product = require('../../models/productSchema'); // Adjust the path to your Product model
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const PDFDocument = require('pdfkit');
const { getDailyOrderCounts } = require('../../services/orderService');
// const SalesReport = require('../../services/salesReport');
const SalesReport = require('../../services/salesReport');
const httpStatusCodes = require('../../constants/httpStatusCodes');

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

function drawTable(doc, tableData, headers, startX, startY, columnWidths, isHeaderRow = true) {
  const rowHeight = 20;
  const padding = 4;
  let currentY = startY;

  // Define column positions
  const colPositions = [startX];
  columnWidths.forEach((width) => {
    colPositions.push(colPositions[colPositions.length - 1] + width);
  });

  // Draw header row
  if (isHeaderRow && headers) {
    // Top border
    doc
      .moveTo(startX, currentY)
      .lineTo(colPositions[colPositions.length - 1], currentY)
      .stroke('#cccccc');

    // Header cells
    headers.forEach((header, i) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1c4587');
      const headerX = colPositions[i] + padding;
      doc.text(header, headerX, currentY + padding, {
        width: columnWidths[i] - 2 * padding,
        align: 'center',
      });

      // Right border
      doc
        .moveTo(colPositions[i + 1], currentY)
        .lineTo(colPositions[i + 1], currentY + rowHeight)
        .stroke('#cccccc');
    });

    // Bottom border for header
    currentY += rowHeight;
    doc
      .moveTo(startX, currentY)
      .lineTo(colPositions[colPositions.length - 1], currentY)
      .stroke('#1c4587'); // Thicker for header bottom
  }

  // Draw data rows
  tableData.forEach((row) => {
    // Top border for each row
    doc
      .moveTo(startX, currentY)
      .lineTo(colPositions[colPositions.length - 1], currentY)
      .stroke('#cccccc');

    // Row cells
    row.forEach((cell, i) => {
      doc.font('Helvetica').fontSize(9).fillColor('#333333');
      let fontSize = 9;
      while (doc.widthOfString(cell.toString()) > columnWidths[i] - 2 * padding && fontSize > 6) {
        fontSize -= 0.5;
        doc.fontSize(fontSize);
      }

      const text = cell.toString();
      const x = colPositions[i] + padding; // Left align data
      doc.text(text, x, currentY + padding, {
        width: columnWidths[i] - 2 * padding,
        align: 'left',
      });

      doc.fontSize(9); // Reset

      // Right border
      doc
        .moveTo(colPositions[i + 1], currentY)
        .lineTo(colPositions[i + 1], currentY + rowHeight)
        .stroke('#cccccc');
    });

    // Bottom border
    currentY += rowHeight;
    doc
      .moveTo(startX, currentY)
      .lineTo(colPositions[colPositions.length - 1], currentY)
      .stroke('#cccccc');
  });

  return currentY; // Return the end Y for next content
}

function addFooter(doc) {
  const footerY = doc.page.height - 40;
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#999999')
    .text(
      `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | Confidential - For Internal Use Only`,
      50,
      footerY,
      { width: doc.page.width - 100, align: 'center' }
    );

  // Footer line
  doc
    .moveTo(50, footerY + 10)
    .lineTo(doc.page.width - 50, footerY + 10)
    .stroke('#dddddd');
}

async function generatePdfContent(doc, salesData, orders, type, startDate, endDate) {
  try {
    // Page margins
    const margin = 50;
    const pageWidth = doc.page.width - 2 * margin;

    // Cover page setup
    doc
      .font('Helvetica-Bold')
      .fontSize(28)
      .fillColor('#1c4587')
      .text('Sales Report', margin, 150, { align: 'center', width: pageWidth });

    // Subtitle
    const reportTitle = getReportTitle(type, startDate, endDate);
    doc
      .font('Helvetica')
      .fontSize(14)
      .fillColor('#666666')
      .text(reportTitle, margin, 200, { align: 'center', width: pageWidth });

    // Logo (centered at top)
    try {
      const logoPath = path.join(__dirname, '..', 'public', 'images', 'logo.png');
      if (fs.existsSync(logoPath)) {
        const logoWidth = 80;
        const logoX = (doc.page.width - logoWidth) / 2;
        doc.image(logoPath, logoX, 80, { width: logoWidth });
      }
    } catch (logoError) {
      console.warn('Logo not found or could not be loaded:', logoError.message);
    }

    // Company info or empty space
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#999999')
      .text('Professional Sales Analytics', margin, 300, { align: 'center', width: pageWidth });
    doc.addPage();

    // Executive Summary Section
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#1c4587')
      .text('Executive Summary', margin, margin);
    let currentY = doc.y + 10;

    // Calculate totals
    let totalSales = salesData.reduce((total, sale) => total + sale.totalSales, 0);
    let totalDiscount = salesData.reduce((total, sale) => total + sale.totalDiscount, 0);
    let totalOrders = salesData.reduce((total, sale) => total + sale.orderCount, 0);
    let averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    const summaryData = [
      ['Metric', 'Value'],
      [
        'Total Revenue',
        `₹${totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ],
      [
        'Total Discount',
        `₹${totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ],
      [
        'Net Revenue',
        `₹${(totalSales - totalDiscount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ],
      ['Total Orders', totalOrders.toLocaleString()],
      [
        'Average Order Value',
        `₹${averageOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ],
    ];

    const summaryColumnWidths = [(pageWidth / 3) * 2, pageWidth / 3];
    currentY = drawTable(
      doc,
      summaryData.slice(1),
      summaryData[0],
      margin,
      currentY,
      summaryColumnWidths
    );

    if (currentY > doc.page.height - 100) {
      doc.addPage();
      currentY = margin;
    }

    doc
      .moveTo(margin, currentY + 5)
      .lineTo(doc.page.width - margin, currentY + 5)
      .stroke('#1c4587');
    currentY += 20;
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#666666')
      .text('All figures are in Indian Rupees (INR).', margin, currentY);
    currentY += 40;

    // Detailed Sales Statistics Section
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#1c4587')
      .text('Detailed Sales Statistics', margin, currentY);
    currentY += 30;

    const salesHeaders = [
      'Date',
      'Total Sales (₹)',
      'Total Discount (₹)',
      'Net Revenue (₹)',
      'Order Count',
    ];
    const salesRows = salesData.map((sale) => {
      const netRevenue = sale.totalSales - sale.totalDiscount;
      return [
        new Date(sale._id).toLocaleDateString(),
        sale.totalSales.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        sale.totalDiscount.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        netRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        sale.orderCount.toLocaleString(),
      ];
    });

    const salesColumnWidths = [
      pageWidth * 0.2,
      pageWidth * 0.2,
      pageWidth * 0.2,
      pageWidth * 0.2,
      pageWidth * 0.2,
    ];
    currentY = drawTable(doc, salesRows, salesHeaders, margin, currentY, salesColumnWidths);

    // Handle multi-page for sales table if needed (drawTable handles pagination internally by returning Y, but for simplicity, check before drawing)
    if (currentY > doc.page.height - 150) {
      doc.addPage();
      currentY = margin;
    }

    currentY += 20;

    // Individual Order Details Section
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#1c4587')
      .text('Individual Order Details', margin, currentY);
    currentY += 30;

    // Fetch all users
    const users = await User.find({});
    const userMap = users.reduce((map, user) => {
      map[user._id] = user.name;
      return map;
    }, {});

    const orderHeaders = [
      'Order ID',
      'Customer Name',
      'Total Price (₹)',
      'Discount (₹)',
      'Net Price (₹)',
      'Order Date',
      'Status',
    ];
    const orderRows = orders.map((order) => {
      const userName = userMap[order.userId] || 'Unknown User';
      const netPrice = order.totalPrice - (order.discount || 0);
      return [
        order._id.toString().substring(0, 8) + '...',
        userName,
        order.totalPrice.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        (order.discount || 0).toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        netPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        new Date(order.orderDate).toLocaleDateString(),
        order.status,
      ];
    });

    const orderColumnWidths = [
      pageWidth * 0.1,
      pageWidth * 0.2,
      pageWidth * 0.15,
      pageWidth * 0.15,
      pageWidth * 0.15,
      pageWidth * 0.1,
      pageWidth * 0.1,
    ];
    currentY = drawTable(doc, orderRows, orderHeaders, margin, currentY, orderColumnWidths);

    // Add footer to last page
    addFooter(doc);
  } catch (error) {
    console.error('Error generating PDF content:', error);
    doc
      .font('Helvetica')
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
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
  }
};

const getOrdersCount = async (req, res) => {
  try {
    const { timeUnit, startDate, endDate } = req.query;

    // Validate timeUnit
    const validTimeUnits = ['day', 'month', 'year'];
    if (!validTimeUnits.includes(timeUnit)) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({ error: 'Invalid time unit' });
    }

    // Validate and parse dates
    let matchStage = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start) || isNaN(end)) {
        return res.status(httpStatusCodes.BAD_REQUEST).json({ error: 'Invalid date format' });
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
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: 'Error fetching order counts' });
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
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: 'Error fetching order stats', error });
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
      currentPath: '/dashboard',
      layout: 'layouts/adminLayout',
    });
  } catch (error) {
    console.error('Error fetching orders:', error); // Log the error for debugging
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).send('Internal Server Error'); // Send a response in case of error
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
        return res.status(httpStatusCodes.BAD_REQUEST).json({ message: 'Invalid report type' });
    }

    res.json(salesData);
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Server error' });
  }
};

const getSalesReportPDF = async (req, res) => {
  const { type, startDate, endDate } = req.query;

  // Validate that startDate and endDate are present for custom reports
  if (type === 'custom' && (!startDate || !endDate)) {
    return res
      .status(httpStatusCodes.BAD_REQUEST)
      .json({ message: 'Start date and end date are required for custom reports' });
  }

  // Validate and convert the dates for custom report
  let start = type === 'custom' ? new Date(startDate) : null;
  let end = type === 'custom' ? new Date(endDate) : null;

  // Check if the dates are valid for custom report
  if (type === 'custom' && (isNaN(start.getTime()) || isNaN(end.getTime()))) {
    return res
      .status(httpStatusCodes.BAD_REQUEST)
      .json({ message: 'Invalid start date or end date' });
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
        return res.status(httpStatusCodes.BAD_REQUEST).json({ message: 'Invalid report type' });
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

    // Create PDF document with improved layout
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sales-report-${type}-${new Date().toISOString().split('T')[0]}.pdf"`
    );

    // Pipe the PDF document to the response
    doc.pipe(res);

    // Set default styles
    doc.font('Helvetica').fontSize(10).fillColor('#333333');

    // Generate PDF content
    await generatePdfContent(doc, salesData, orders, type, start, end);

    // Finalize PDF file
    doc.end();
  } catch (error) {
    console.error('Error generating PDF report:', error);
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: 'Server error', error: error.message });
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
