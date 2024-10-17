const express=require('express');

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const methodOverride=require('method-override')
const Product = require('../models/productSchema'); // Adjust the path to your Product model
const Category=require('../models/categorySchema')
const userModel=require('../models/userSchema')
const Order=require('../models/orderSchema')
const Coupon=require('../models/couponSchema')
const Offer=require('../models/offerSchema')
const User=require('../models/userSchema')
const {jwtAuth,adminProtected,userProtected}=require('../middlewares/auth');
const adminController=require('../controllers/adminController')
const Cart=require('../models/cartSchema')
const router=express.Router();
const Banner=require('../models/bannerSchema')
router.use(express.urlencoded({ extended: true })); // To parse form data
router.use(methodOverride('_method')); 

const uploadsDir = path.join(__dirname, '../uploads');

router.use(jwtAuth,adminProtected)




const { getDailyOrderCounts } = require('../services/orderService');

router.get('/sales/graph', async (req, res) => {
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
        month: { $month: '$orderDate' }
      };
      sortBy = { '_id.year': 1, '_id.month': 1 };
    } else if (type === 'weekly') {
      groupBy = { 
        year: { $year: '$orderDate' },
        week: { $week: '$orderDate' }
      };
      sortBy = { '_id.year': 1, '_id.week': 1 };
    }

    pipeline = [
      { $match: { status: 'delivered' } },
      { $group: {
        _id: groupBy,
        sales: { $sum: '$totalPrice' }
      }},
      { $sort: sortBy }
    ];

    const salesData = await Order.aggregate(pipeline);

    // Format the data for the chart
    const formattedData = salesData.map(item => ({
      name: type === 'yearly' ? item._id.toString() :
            type === 'monthly' ? `${item._id.year}-${item._id.month}` :
            `${item._id.year}-W${item._id.week}`,
      sales: item.sales
    }));

    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching sales graph data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/orders/counts', async (req, res) => {
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
            $lte: end 
          }
        }
      };
    }

    let groupStage = {};
    switch (timeUnit) {
      case 'day':
        groupStage = {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalPrice" }
          }
        };
        break;
      case 'month':
        groupStage = {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalPrice" }
          }
        };
        break;
      case 'year':
        groupStage = {
          $group: {
            _id: { $dateToString: { format: "%Y", date: "$createdAt" } },
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalPrice" }
          }
        };
        break;
    }

    const sortStage = { $sort: { _id: 1 } }; // This can remain unchanged

    const orderCounts = await Order.aggregate([
      matchStage,
      groupStage,
      sortStage
    ]);

    res.json(orderCounts);
  } catch (error) {
    console.error('Error fetching order counts:', error);
    res.status(500).json({ error: 'Error fetching order counts' });
  }
});




router.get('/orders/stats', async (req, res) => {
  try {
      const orders = await Order.find({});
      console.log('Fetched orders:', orders); // Log all fetched orders
      const statusCounts = {};

      orders.forEach(order => {
          const status = order.status;
          statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      console.log('Status Counts:', { 'statusCounts': statusCounts }); // Log status counts
      res.json({ 'statusCounts': statusCounts });
  } catch (error) {
      console.error('Error fetching order stats:', error); // Log the error for debugging
      res.status(500).json({ message: 'Error fetching order stats', error });
  }

});
// router.get('/dashboard',adminController.getDashboard)
router.get('/dashboard', async (req, res) => {
  try {
    const orders = await Order.find({})
    const customers=await User.find({})
    
    
    // for top product,category,brand
    const productcountbybrandcount = await Product.aggregate([
      {
        $group: {
          _id: '$brand',
          count: { $sum: 1 }
        },
      },
      {
        $sort: {
          count: -1
        }
      },
      {
        $limit: 10
      }
    ]);
    console.log('Product Count by Brand:', productcountbybrandcount);
  
    const topSellingProducts = await Product.aggregate([
     
      {
        $sort: {
          orderCount:-1
        }
      },
      {
        $limit: 10
      },
      {
        $project: {
          _id: 1,
          product: 1,
          brand: 1,
          category: 1,
          orderCount: 1 
        }
      }
    ]);
    console.log('Product Count by Purchased:', topSellingProducts);
    const topSellingCategories = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          totalSales: { $sum: '$orderCount' } // Correctly reference with $
        }
      },
      {
        $sort: {
          totalSales: -1
        }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'categories', // Ensure this is lowercase
          localField: '_id',
          foreignField: '_id',
          as: 'categoryData'
        }
      },
      {
        $unwind: '$categoryData' // Correctly reference here
      },
      {
        $project: {
          _id: 1,
          category: '$categoryData.name', // Correctly reference the unwound field
          totalSales: 1
        }
      }
    ]);
    
  console.log('top selling categories',topSellingCategories)
  const topSellingBrands=await Product.aggregate([
    {
      $group:{
        _id:'$brand',
        totalSales:{$sum:'$orderCount'}
      }
    },
    {
      $sort:{
        totalSales:-1
      }
    },
    {
      $limit:10
    },
    {
      $project:{
        brand:1,
        totalSales:1
      }
    }
  ])  



    const ordersCount=orders.filter(order=>order.status==='delivered').length; 
    console.log('Orders Count:', ordersCount);
    
    let totalDiscount = 0;
    let totalRevenue = 0;
    let customersCount=customers.length
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
      topSellingBrands
    });
  } catch (error) {
    console.error('Error fetching orders:', error); // Log the error for debugging
    res.status(500).send('Internal Server Error'); // Send a response in case of error
  }
});


const SalesReport = require('../services/salesReport'); // Adjust path if necessary

// Route to get daily sales report
router.get('/sales/report', async (req, res) => {
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
});
const pdf = require('html-pdf');

router.get('/sales/report/pdf', async (req, res) => {
  const { type, startDate, endDate } = req.query;

  // Validate that startDate and endDate are present for custom reports
  if (type === 'custom' && (!startDate || !endDate)) {
      return res.status(400).json({ message: 'Start date and end date are required for custom reports' });
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
                  $lte: end
              }
          });
      } else {
          // For daily, weekly, monthly, yearly, fetch orders accordingly
          const dateKey = type === 'daily' ? 'day'
                        : type === 'weekly' ? 'week'
                        : type === 'monthly' ? 'month'
                        : 'year'; // Assuming you have a function to get start and end date for the type

          const dateRange = getDateRange(type); // Implement this function to get start and end dates based on type
          orders = await Order.find({
              orderDate: {
                  $gte: dateRange.start,
                  $lte: dateRange.end
              }
          });
      }

      const html = await generatePdfHtml(salesData, orders, type, start, end); // Pass orders instead of startDate, endDate
      const options = { format: 'A4' };

      pdf.create(html, options).toBuffer((err, buffer) => {
          if (err) return res.status(500).send(err);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
          res.send(buffer);
      });
  } catch (error) {
      console.error('Error generating PDF report:', error);
      res.status(500).json({ message: 'Server error' });
  }
});
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

async function generatePdfHtml(salesData, orders, type, startDate, endDate) {
  let totalSales = salesData.reduce((total, sale) => total + sale.totalSales, 0).toFixed(2);
  let totalDiscount = salesData.reduce((total, sale) => total + sale.totalDiscount, 0).toFixed(2);
  let totalOrders = salesData.reduce((total, sale) => total + sale.orderCount, 0);

  // Get the current date for daily reports or when dates are not provided
  const currentDate = new Date();

  // Define variables for the report title
  let reportTitle = '';
  let datePart = '';

  // Handle different types of reports
  switch (type) {
      case 'daily':
          reportTitle = `Daily Sales Report - ${currentDate.toLocaleDateString()}`;
          break;
      case 'weekly':
          if (startDate && endDate) {
              reportTitle = `Weekly Sales Report (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`;
          } else {
              reportTitle = 'Weekly Sales Report';
          }
          break;
      case 'monthly':
          // Display the month and year (e.g., October 2024)
          const monthName = currentDate.toLocaleString('default', { month: 'long' });
          const year = currentDate.getFullYear();
          reportTitle = `Monthly Sales Report - ${monthName} ${year}`;
          break;
      case 'yearly':
          // Display only the year (e.g., 2024)
          const reportYear = currentDate.getFullYear();
          reportTitle = `Yearly Sales Report - ${reportYear}`;
          break;
      case 'custom':
          if (startDate && endDate) {
              reportTitle = `Custom Sales Report (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`;
          } else {
              reportTitle = 'Custom Sales Report';
          }
          break;
      default:
          reportTitle = `Sales Report`;
  }
  let html = `
  <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f4f4f4;
        }
        h1 {
          text-align: center;
          color: #333;
        }
        h2 {
          color: #444;
          border-bottom: 2px solid #007BFF;
          padding-bottom: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          background: #fff;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: center;
        }
        th {
          background-color: #007BFF;
          color: white;
        }
        tr:nth-child(even) {
          background-color: #f2f2f2;
        }
        tr:hover {
          background-color: #ddd;
        }
        .summary {
          margin: 20px 0;
          padding: 10px;
          background-color: #007BFF;
          color: white;
          border-radius: 5px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 0.9em;
          color: #666;
        }
      </style>
    </head>
    <body>
    <h1>${reportTitle}</h1>
      <h1>Sales Report</h1>
      
      <div class="summary">
        <strong>Total Revenue:</strong> ${totalSales}<br>
        <strong>Total Discount:</strong> ${totalDiscount}<br>
        <strong>Total Success Orders:</strong> ${totalOrders}<br>
      </div>

      <h2>Overall Statistics</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Total Sales</th>
            <th>Total Discount</th>
            <th>Success Order Count</th>
          </tr>
        </thead>
        <tbody>`;

  salesData.forEach(sale => {
      html += `<tr>
                  <td>${sale._id}</td>
                  <td>${sale.totalSales.toFixed(2)}</td>
                  <td>${sale.totalDiscount.toFixed(2)}</td>
                  <td>${sale.orderCount}</td>
              </tr>`;
  });

  html += `</tbody>
      </table>

      <h2>Individual Orders</h2>
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>User Name</th>
            <th>Total Price</th>
            <th>Discount</th>
            <th>Order Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>`;

  // Fetch all users to get their names
  const users = await User.find({}); // Assuming User is your User model
  const userMap = users.reduce((map, user) => {
      map[user._id] = user.name; // Create a map of userId to userName
      return map;
  }, {});

  orders.forEach(order => {
      const userName = userMap[order.userId] || "Unknown User"; // Get user name or set to "Unknown User"
      html += `<tr>
                  <td>${order._id}</td>
                  <td>${userName}</td>
                  <td>${order.totalPrice.toFixed(2)}</td>
                  <td>${order.discount ? order.discount.toFixed(2) : 0}</td>
                  <td>${new Date(order.orderDate).toLocaleDateString()}</td>
                  <td>${order.status}</td>
              </tr>`;
  });

  html += `</tbody>
      </table>

      <div class="footer">
        <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
      </div>
    </body>
  </html>`;

  return html;
}



// admin product section************************************************************************************
router.get('/products',adminController.getProduct)
router.get('/products/viewproducts',adminController.getViewProduct)
router.get('/products/add-product',adminController.getAddProduct)
// Ensure the upload directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

// Function to save base64 image data
const saveBase64Image = async (dataUrl, filename) => {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('Invalid base64 image data');
  }

  const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 image data format');
  }

  const fileExtension = matches[1] || 'jpeg'; // Default to jpeg if unspecified
  const base64Data = matches[2].replace(/\s/g, ''); // Remove whitespace

  const filePath = path.join(uploadsDir, `${filename}.${fileExtension}`);

  try {
    await sharp(Buffer.from(base64Data, 'base64')).toFile(filePath);
  } catch (error) {
    console.error('Error saving image with sharp:', error);
    throw new Error('Failed to save image');
  }

  return filePath;
};
router.post('/products/add-product', upload.array('productImages', 5),adminController.postAddProduct );

// Helper function to generate a unique filename
const generateUniqueFilename = () => {
  return `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
};
router.post('/products/unlist-product/:id',adminController.postUnlist)
router.post('/products/list-product/:id',adminController.postList)

router.get('/products/edit/:id',adminController.getProductEdit)
router.patch('/products/edit-product/:id', upload.array('productImages', 5), adminController.patchProductEdit);

// delete image
router.delete('/delete-image/:productId/:imageId', async (req, res) => {
  const productId = req.params.productId;
  const imageId = req.params.imageId;

  try {
      // Remove the image with the specified ID from the specified product's images array
      await Product.updateOne(
          { _id: productId },
          { $pull: { images: { id: imageId } } } // Remove the image by its ID
      );

      res.status(200).send({ message: 'Image deleted successfully' });
  } catch (error) {
      console.error(error);
      res.status(500).send({ message: 'Error deleting image' });
  }
});
// admin/products/edit/66d57f2a530693faed1f2e4c/
// router.post('/products/edit/:product-id',(req,res)=>{
//   res.json('success')
// })


// admin customers section


// Get all customers******************************************************************************
router.get('/customers', adminController.getCustomers);
router.post('/customers/block-user/:id',adminController.postCustomerBlock)
router.post('/customers/unblock-user/:id',adminController.postCustomerUnblock)


// CATETGORY**************************************************************************

router.get('/category',adminController.getCategory)
router.get('/category/update/:id',adminController.getCategoryUpdate)

router.patch('/category/update/:id',adminController.patchCategoryUpdate)
// router.delete('/category/delete/:id',adminController.deleteCategoryDelete)
router.get('/category/add-category',adminController.getAddCategory)
router.post('/category/add-category',adminController.postAddCategory)

router.post('/category/block/:id',adminController.postCategoryBlock)
router.post('/category/unblock/:id',adminController.postCategoryUnblock)

// ORDER ****************************************

router.get('/orders', adminController.getOrders);

router.get('/orders/:orderId/edit', adminController.getEditOrder);
router.post('/orders/:orderId/edit', adminController.postEditOrder);
router.get('/orders/:orderId',adminController.getOrderDetailedPage)
// Inventory and stock management
router.get('/inventory', adminController.getInventory);

router.post('/inventory/update', adminController.postInventoryUpdate);

// coupon management ******************************************************************
router.get('/coupons',async(req,res)=>{
  try{
    const coupons=await Coupon.find({});
    res.render('admincoupon/coupon',{coupons:coupons})
  }catch(error){
    res.status(400).json({success:false,message:error.message})
  }
})
router.get('/coupon/edit/:id', async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(400).json({ success: false, message: 'Coupon not found' });
    }
    res.render('admincoupon/editcoupon', { coupon: coupon });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.patch('/coupon/edit/:id', async (req, res) => {
  try {
    const couponId = req.params.id;
    const { 
      couponCode, 
      discountType, 
      discountValue, 
      startDate, 
      endDate, 
      minPurchaseAmount, 
      usageLimit 
    } = req.body;

    // Validate required fields
    if (!couponCode || !discountType || !discountValue || !startDate || !endDate || !minPurchaseAmount || !usageLimit) {
      return res.status(400).json({ success: false, message: 'Please fill all fields' });
    }

    // Validate coupon code format
    const couponCodeRegex = /^[A-Z0-9]{6,12}(-[A-Z0-9]{6,12})?$/;
    if (!couponCodeRegex.test(couponCode)) {
      return res.status(400).json({ success: false, message: 'Invalid coupon code. Only uppercase letters and numbers allowed.' });
    }

    // Check for existing coupon code excluding the current one
    const existingCoupon = await Coupon.findOne({ couponCode, _id: { $ne: couponId } });
    if (existingCoupon) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }

    // Validate numeric values
    if (isNaN(discountValue) || discountValue < 0) {
      return res.status(400).json({ success: false, message: 'Discount value must be a valid number and cannot be negative' });
    }
    if (discountValue > 60) {
      return res.status(400).json({ success: false, message: 'Discount percentage must be less than 60' });
    }
    if (isNaN(minPurchaseAmount) || minPurchaseAmount < 400) {
      return res.status(400).json({ success: false, message: 'Minimum purchase amount cannot be less than 400' });
    }
    if (usageLimit < 0) {
      return res.status(400).json({ success: false, message: 'Usage limit should be greater than zero' });
    }

    // Validate discount type (only percentage allowed)
    const validDiscountTypes = ['percentage'];
    if (!validDiscountTypes.includes(discountType)) {
      return res.status(400).json({ success: false, message: 'Invalid discount type. Only "percentage" is allowed.' });
    }

    // Parse and validate start and end dates
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }

    // Ensure that endDate is in the future
    const now = new Date();
    if (parsedEndDate <= now) {
      return res.status(400).json({ success: false, message: 'End date must be in the future' });
    }

    // Ensure that endDate is after startDate
    if (parsedEndDate <= parsedStartDate) {
      return res.status(400).json({ success: false, message: 'End date must be after start date' });
    }

    // Update the coupon
    const updatedCoupon = await Coupon.findByIdAndUpdate(couponId, {
      couponCode,
      discountType,
      discountValue,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      minPurchaseAmount,
      usageLimit
    }, { new: true });

    // Respond with success message
    res.status(200).json({ success: true, message: 'Coupon updated successfully', coupon: updatedCoupon });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});


router.get('/coupon/add-coupon',async(req,res)=>{
  try {
    res.render('admincoupon/addcoupon')
  } catch (error) {
    res.status(400).json({success:false,message:error.message})
  }
})
router.post('/coupon/add-coupon',async(req,res)=>{
  try {
    
    const {couponCode,discountType,discountValue,startDate,endDate,minPurchaseAmount,usageLimit}=req.body;
    console.log('reqy',req.body)
    if(!couponCode || !discountType || !discountValue ||!startDate || !endDate || !minPurchaseAmount|| !usageLimit){
      return res.status(400).json({success:false,message:'Please fill all fieldss'})
    }
    const couponCodeRegex=/^[A-Z0-9]{6,12}(-[A-Z0-9]{6,12})?$/;
    if(!couponCodeRegex.test(couponCode)){
      return res.status(400).json({success:false,message:'Invalid coupon code and only alpha cap and num'})
    }
    const coupon=await Coupon.findOne({couponCode});
    if(coupon){
      return res.status(400).json({success:false,message:'Coupon code already exists'})
    }
    if (isNaN(discountValue) || discountValue < 0) {
      return res.status(400).json({ success: false, message: 'Discount value must be a valid number and cannot be negative' });
    }
    if(discountValue>60){
      return res.status(400).json({success:false,message:'Discount Percentage Must be less than 60'})
    }
    if(isNaN(minPurchaseAmount) || minPurchaseAmount<400){
      return res.status(400).json({success:false,message:'Minimum purchase amount cannot be less than 400'})
    }

    
    if(usageLimit<0){
      return res.status(400).json({success:false,message:'the limit should be greter zero'})
    }
    const parsedStartDate = new Date(startDate);
const parsedEndDate = new Date(endDate);

// Check if the start date and end date are valid
if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
  return res.status(400).json({ success: false, message: 'Invalid date format' });
}

// Ensure that endDate is in the future
const now = new Date();
if (parsedEndDate <= now) {
  return res.status(400).json({ success: false, message: 'End date must be in the future' });
}

// Ensure that endDate is after startDate or equal to today
if (parsedEndDate < parsedStartDate) {
  return res.status(400).json({ success: false, message: 'End date must be after start date' });
}
    const validDiscountTypes = ['percentage'];
    if (!validDiscountTypes.includes(discountType)) {
      return res.status(400).json({ success: false, message: 'Invalid discount type' });
    }


    const newCoupon=new Coupon({
      couponCode:couponCode,
      discountType:discountType,
      discountValue:discountValue,
      startDate:parsedStartDate,
      endDate:parsedEndDate,
      minPurchaseAmount:minPurchaseAmount,
      usageLimit:usageLimit,

    })
    await newCoupon.save();
    res.status(200).json({success:true,message:'coupon added successfuly'})

  } catch (error) {
    res.status(400).json({success:false,message:error.message})
  }
})

router.delete('/coupon/delete/:id', async (req, res) => {
  try {
    const couponId = req.params.id;
    
    
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    
    await Coupon.findByIdAndDelete(couponId);

    
    res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    
    console.error('Error deleting coupon:', error);
    
    
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


// offer*******************************************************************
router.get('/offers', async (req, res) => {
  try {
    const offers = await Offer.find({}).populate('categoryIds');
    // if (!offers || offers.length === 0) {
    //   return res.status(400).json({ success: false, message: 'Offers not found' });
    // }
    const products=await Product.find()
    res.render('adminoffer/offer', { offers ,products});
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/offers/add-offer', async (req, res) => {
  try {
    const categories = await Category.find({});
    const products = await Product.find({}); // Fetch all products as well
    res.render('adminoffer/addoffer', { categories, products }); // Pass products to the template
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.post('/offers/add-offer', async (req, res) => {
  try {
    const {
      offerName,
      offerType,
      discountType,
      discountValue,
      startDate,
      endDate,
      offerStatus,
      offerDescription,
      productSelection = [],
      categorySelection = []
    } = req.body;

    console.log(req.body, 'req.body');

    // Validation checks
    if (!offerName) {
      return res.status(400).json({ success: false, message: "OfferName is required" });
    }
    if (!offerType) {
      return res.status(400).json({ success: false, message: "OfferType is required" });
    }
    if (!discountType) {
      return res.status(400).json({ success: false, message: "DiscountType is required" });
    }
    if (!discountValue) {
      return res.status(400).json({ success: false, message: "DiscountValue is required" });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Start and End Date are required" });
    }
    if (!offerStatus) {
      return res.status(400).json({ success: false, message: "OfferStatus is required" });
    }
    if (!offerDescription) {
      return res.status(400).json({ success: false, message: "OfferDescription is required" });
    }

    const regex = /^[A-Z0-9]+$/;
    if (!regex.test(offerName)) {
      return res.status(400).json({ success: false, message: 'Only capital letters and numbers are allowed' });
    }

    // Check if the offer type is valid
    const validOfferTypes = ['category', 'product'];
    if (!validOfferTypes.includes(offerType)) {
      return res.status(400).json({ success: false, message: 'Invalid offer type' });
    }

    // Validate discount value
    if (discountValue >= 60) {
      return res.status(400).json({ success: false, message: 'Discount Value must be less than 60' });
    }
    if (discountValue <= 0) {
      return res.status(400).json({ success: false, message: "Discount Value must be greater than 0" });
    }

    // Validate startDate and endDate
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({ success: false, message: 'End date must be after start date' });
    }
    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }

    const validStatuses = ['active', 'inactive'];
    if (!validStatuses.includes(offerStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid offer status' });
    }

    const existingOffers = await Offer.find({ offerName: offerName });
    if (existingOffers.length > 0) {
      return res.status(400).json({ success: false, message: 'An offer with this name already exists.' });
    }

    // Ensure that categorySelection and productSelection are arrays
    const categoryIds = Array.isArray(categorySelection) ? categorySelection : (categorySelection ? [categorySelection] : []);
    const productIds = Array.isArray(productSelection) ? productSelection : (productSelection ? [productSelection] : []);

    // Validate category or product selection
    if (offerType === 'category' && categoryIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one category' });
    }
    if (offerType === 'product' && productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one product' });
    }

    // Check for overlapping offers if offerType is 'category'
    const overlappingOffers = await Offer.find({
      offerType: offerType,
      startDate: { $lt: endDate },
      endDate: { $gt: startDate },
      ...(offerType === 'category' ? { categoryIds: { $in: categoryIds } } : { productIds: { $in: productIds } }),
      offerStatus: 'active'
    });
    if (overlappingOffers.length > 0) {
      return res.status(400).json({ success: false, message: 'An overlapping offer already exists for the selected category or product during this date range.' });
    }

    // Create new offer
    const offer = new Offer({
      offerName,
      offerType,
      discountType,
      discountValue,
      startDate: start,
      endDate: end,
      offerStatus,
      offerDescription,
      ...(offerType === 'category' ? { categoryIds: categoryIds } : { productIds: productIds })
    });

    // Handle applying the offer to products based on the selection
    if (offerType === 'category' && categoryIds.length > 0) {
      // Fetch products that belong to the selected categories
      const products = await Product.find({ category: { $in: categoryIds } });
      await applyOfferToProducts(products, offer, discountValue, discountType);
    } else if (offerType === 'product' && productIds.length > 0) {
      // Fetch selected products
      const products = await Product.find({ _id: { $in: productIds } });
      await applyOfferToProducts(products, offer, discountValue, discountType);
    }

    // Save the offer
    await offer.save();
    res.status(200).json({ success: true, message: 'Offer created successfully' });
  } catch (error) {
    console.log('add offer error', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Function to apply offer to products
async function applyOfferToProducts(products, offer, discountValue, discountType) {
  await Promise.all(products.map(async (product) => {
    const discountAmount = discountType === 'percentage' ? (product.price * discountValue / 100) : discountValue;
    const newPrice = product.price - discountAmount;
    if (newPrice < product.finalPrice) {
      product.finalPrice = Math.floor(newPrice);
    }
    product.offerApplied = true;
    product.offers.push(offer._id); // Add the offer ID to the product's offers array
    await product.save(); // Save the updated product

    // Update cart final price if necessary
    const cartItems = await Cart.find({ 'products.productId': product._id });
    for (const cart of cartItems) {
      let totalPrice = 0;
      let finalTotalPrice = 0;
      for (const item of cart.products) {
        if (item.productId.equals(product._id)) {
          totalPrice += product.price * item.quantity;
          finalTotalPrice += (product.finalPrice) * item.quantity;
        }
      }
      // Update the cart prices
      await Cart.updateOne(
        { _id: cart._id },
        { $set: { finalTotalPrice, finalPrice: finalTotalPrice } }
      );
    }
  }));
}

// GET route to render the edit offer form
router.get('/offers/edit-offer/:id', async (req, res) => {
  try {
      const offerId = req.params.id;
      const offer = await Offer.findById(offerId); // Fetch the specific offer
      console.log('Fetched offer:', offer);

      if (!offer) {
          // return res.status(404).render('errorPage', { message: 'Offer not found' }); // Render an error page
          return res.status(404).json({success:false,message:'offer not found'})
      }

      // Fetch all products and categories to populate the select options
      const categories = await Category.find();
      const products = await Product.find();
      console.log('Categories:', categories);
      console.log('Products:', products);

      res.render('adminoffer/editoffer', {
          offer,
          categories,  // Pass categories to the template
          products     // Pass products to the template
      });
  } catch (error) {
      console.error('Error fetching offer for editing:', error.message);
      res.status(500).json({ success: false, message: error.message });
  }
});

// POST route to handle form submission for editing an offer
router.post('/offers/edit-offer/:id', async (req, res) => {
  const offerId = req.params.id;

  // Destructure the incoming request body
  const {
      offerName,
      offerType,
      discountType,
      discountValue,
      startDate,
      endDate,
      offerStatus,
      offerDescription,
      categorySelection = [],
      productSelection = []
  } = req.body;

  try {
      // Input validation
      if (!offerName || !offerType || !discountType || !discountValue || !startDate || !endDate || !offerStatus || !offerDescription) {
          return res.status(400).json({ success: false, message: "All fields are required." });
      }

      // Offer Name validation
      const regex = /^[A-Z0-9]+$/;
      if (!regex.test(offerName)) {
          return res.status(400).json({ success: false, message: 'Only capital letters and numbers are allowed for Offer Name.' });
      }

      // Discount Value validation
      if (discountValue >= 60 || discountValue <= 0) {
          return res.status(400).json({ success: false, message: 'Discount Value must be between 1 and 59.' });
      }

      // Date validation
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start) || isNaN(end) || start >= end) {
          return res.status(400).json({ success: false, message: 'Invalid date range: Start date must be before End date.' });
      }

      // Find existing offer
      const existingOffer = await Offer.findById(offerId);
      if (!existingOffer) {
          return res.status(404).json({ success: false, message: 'Offer not found' });
      }

      // Update offer details
      existingOffer.offerName = offerName;
      existingOffer.offerType = offerType; // Changed to match previous naming
      existingOffer.discountType = discountType;
      existingOffer.discountValue = discountValue;
      existingOffer.startDate = start;
      existingOffer.endDate = end;
      existingOffer.offerStatus = offerStatus;
      existingOffer.offerDescription = offerDescription;

      // Set selections based on offer type
      if (offerType === 'category') {
          existingOffer.categoryIds = categorySelection; // Only categories
          existingOffer.productIds = []; // Clear product selection
      } else if (offerType === 'product') {
          existingOffer.productIds = productSelection; // Only products
          existingOffer.categoryIds = []; // Clear category selection
      }

      // Save the updated offer
      await existingOffer.save();

      // Apply the offer to products if it's a category-based offer
      if (offerType === 'category') {
          const productsToUpdate = await Product.find({ category: { $in: categorySelection } });
          await applyOfferToProducts(productsToUpdate, existingOffer, discountValue, discountType);
      }

      // Optionally, apply the offer to products if it's a product-based offer
      if (offerType === 'product') {
          const productsToUpdate = await Product.find({ _id: { $in: productSelection } });
          await applyOfferToProducts(productsToUpdate, existingOffer, discountValue, discountType);
      }

      // Redirect or respond with success
      res.status(200).redirect('/admin/offers'); // Redirecting to offers list after successful edit
  } catch (error) {
      console.error('Error updating offer:', error.message);
      res.status(500).json({ success: false, message: error.message });
  }
});


router.delete('/offers/delete-offer/:offerId', async (req, res) => {
  const offerId = req.params.offerId;

  try {
      // Step 1: Find the offer by ID
      const offer = await Offer.findById(offerId);
      if (!offer) {
          return res.status(404).json({ success: false, message: 'Offer not found' });
      }

      // Step 2: Find products associated with the offer
      const products = await Product.find({ offers: offerId });
      console.log('Products associated with the offer before deletion:', products);

      // Step 3: Remove the offer from the products
      await Product.updateMany(
          { offers: offerId },
          { $pull: { offers: offerId } } // Remove the offerId from the offers array
      );

      // Step 4: Reset finalPrice and offerApplied for each product
      for (const product of products) {
          await Product.updateOne(
              { _id: product._id },
              {
                  $set: {
                      finalPrice: product.price, // Reset finalPrice to the original price
                      offerApplied: false         // Reset offerApplied to false
                  }
              }
          );
      }

    
    // Step 5: Update cart final prices if necessary
    const productIds = products.map(product => product._id);
    const cartItems = await Cart.find({ 'products.productId': { $in: productIds } });

    for (const cart of cartItems) {
        let totalPrice = 0;
        let finalTotalPrice = 0;
        for (const item of cart.products) {
            const updatedProduct = products.find(p => {
              console.log('p.id',typeof(p._id),typeof(item.productId))
              return p._id.equals(item.productId)});
              console.log('updateproduct',updatedProduct)
            if (updatedProduct) {
                const quantity = item.quantity;
                totalPrice += updatedProduct.price * quantity; // Original price
                finalTotalPrice += updatedProduct.price * quantity; // Updated final price
            }
        }
        // Update the cart prices
        console.log('Updating cart ID:', cart._id, 'Total Price:', totalPrice, 'Final Total Price:', finalTotalPrice);
        await Cart.updateOne(
            { _id: cart._id },
            { $set: { finalTotalPrice, finalPrice: totalPrice } }
        );
    }
      // Step 6: Delete the offer
      await Offer.findByIdAndDelete(offerId);

      return res.status(200).json({ success: true, message: 'Offer deleted successfully' });
  } catch (error) {
      console.error('Error deleting offer:', error);
      return res.status(500).json({ success: false, message: 'An error occurred while deleting the offer.' });
  }
});


// banner section
// Get banners
router.get('/banners', async (req, res) => {
  try {
      const banners = await Banner.find({});
      res.render('admin/banner', { banners });
  } catch (error) {
      console.log('Error fetching banners:', error.message);
      res.status(500).send('Server Error');
  }
});

// Add banner
router.post('/add-banner', upload.single('image'), async (req, res) => {
  try {
      const { bannerName, description } = req.body;
      const image = req.file;

      if (!image) {
          return res.status(400).json({ success: false, message: 'Image is required' });
      }

      const banner = new Banner({
        bannerName,
        description,
        image: path.join('uploads', image.filename).replace(/\\/g, '/'), // Normalize path
    });
    

      await banner.save();
      res.status(200).json({ success: true, message: 'Banner created successfully' });
  } catch (error) {
      console.log('Error on adding banner', error.message);
      res.status(400).json({ success: false, message: error.message });
  }
});

// Delete banner
router.post('/banners/delete/:bannerId', async (req, res) => {
  try {
      const bannerId = req.params.bannerId;
      const banner = await Banner.findById(bannerId);
      
      if (!banner) {
          return res.status(404).json({ success: false, message: 'Banner not found' });
      }

      await Banner.findByIdAndDelete(bannerId);
      res.status(200).json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
      console.log('Error on deleting banner', error.message);
      res.status(400).json({ success: false, message: error.message });
  }
});


module.exports=router;