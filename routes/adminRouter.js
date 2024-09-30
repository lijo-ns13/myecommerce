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

const router=express.Router();

router.use(express.urlencoded({ extended: true })); // To parse form data
router.use(methodOverride('_method')); 

const uploadsDir = path.join(__dirname, '../uploads');

router.use(jwtAuth,adminProtected)

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
      customersCount
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

// Route to generate PDF sales report
router.get('/sales/report/pdf', async (req, res) => {
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

      const html = await generatePdfHtml(salesData); // Await for PDF HTML
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

// Function to generate HTML for PDF
async function generatePdfHtml(salesData) {
  let totalSales = salesData.reduce((total, sale) => total + sale.totalSales, 0).toFixed(2);
  let totalDiscount = salesData.reduce((total, sale) => total + sale.totalDiscount, 0).toFixed(2);
  let totalOrders = salesData.reduce((total, sale) => total + sale.orderCount, 0);

  // Calculate completed and not completed orders
  let completedOrders = 0;
  let notCompletedOrders = 0;

  salesData.forEach(sale => {
    completedOrders += sale.completedCount || 0; // Assuming you have completedCount in your sales data
    notCompletedOrders += sale.orderCount - (sale.completedCount || 0); // Total orders minus completed orders
  });

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

  const orders = await Order.find({}); // Fetch all orders for individual order details
  orders.forEach(order => {
      const userName = userMap[order.userId] || "Unknown User"; // Get user name or set to "Unknown User"
      html += `<tr>
                  <td>${order._id}</td>
                  <td>${userName}</td>
                  <td>${order.totalPrice.toFixed(2)}</td>
                  <td>${order.discount ? order.discount.toFixed(2) : 0}</td>
                  <td>${new Date(order.orderDate).toLocaleDateString()}</td>
                  <td>${order.status}</td> <!-- Include order status here -->
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
router.post('/products/edit/:id', upload.array('newImages', 5), adminController.patchProductEdit);


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
router.delete('/category/delete/:id',adminController.deleteCategoryDelete)
router.get('/category/add-category',adminController.getAddCategory)
router.post('/category/add-category',adminController.postAddCategory)

// ORDER ****************************************

router.get('/orders', adminController.getOrders);

router.get('/orders/:orderId/edit', adminController.getEditOrder);
router.post('/orders/:orderId', adminController.postEditOrder);

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

// /admin/coupon/edit/<%=coupon._id%>
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
      maxDiscount, 
      usageLimit 
    } = req.body;
    console.log('edit',req.body)

    // Validate required fields
    if (!couponCode || !discountType || !discountValue || !startDate || !endDate || !minPurchaseAmount || !maxDiscount || !usageLimit) {
      return res.status(400).json({ success: false, message: 'Please fill all fields' });
    }

    // Validate coupon code format
    const couponCodeRegex = /^[A-Z0-9]{6,12}(-[A-Z0-9]{6,12})?$/;
    if (!couponCodeRegex.test(couponCode)) {
      return res.status(400).json({ success: false, message: 'Invalid coupon code only capital and number' });
    }

    // Check for existing coupon code excluding the current one
    const couponOne = await Coupon.findOne({ couponCode, _id: { $ne: couponId } });
    if (couponOne) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }

    // Validate discount value
    if (isNaN(discountValue) || discountValue < 0) {
      return res.status(400).json({ success: false, message: 'Discount value must be a valid number and cannot be negative' });
    }

    // Validate minimum purchase amount
    if (minPurchaseAmount < 400) {
      return res.status(400).json({ success: false, message: 'Minimum purchase amount cannot be less than 400' });
    }

    // Validate discount value based on discount type
    if (discountType === 'percentage') {
      if (discountValue <= 0 || discountValue > 80) {
        return res.status(400).json({ success: false, message: 'Percentage discount value should be between 1 and 80' });
      }
    } else if (discountType === 'fixed') {
      if (discountValue <= 0 || discountValue > maxDiscount) {
        return res.status(400).json({ success: false, message: 'Fixed discount value cannot exceed max discount' });
      }
    }

    // Validate global max discount
    if (maxDiscount > 10000) {
      return res.status(400).json({ success: false, message: 'Maximum discount cannot be greater than 10000' });
    }

    // Validate usage limit
    if (usageLimit < 0) {
      return res.status(400).json({ success: false, message: 'The limit should be greater than zero' });
    }

    // Parse and validate start and end dates
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }
    
    if (parsedEndDate <= parsedStartDate) {
      return res.status(400).json({ success: false, message: 'End date must be after start date' });
    }
    
    // Validate discount type
    const validDiscountTypes = ['percentage', 'fixed'];
    if (!validDiscountTypes.includes(discountType)) {
      return res.status(400).json({ success: false, message: 'Invalid discount type' });
    }

    // Update the coupon
    const coupon = await Coupon.findByIdAndUpdate(couponId, req.body, { new: true });
    
    // Respond with success message
    res.status(200).json({ success: true, message: 'Coupon updated successfully', coupon });
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
    
    const {couponCode,discountType,discountValue,startDate,endDate,minPurchaseAmount,maxDiscount,usageLimit}=req.body;
    console.log('reqy',req.body)
    if(!couponCode || !discountType || !discountValue ||!startDate || !endDate || !minPurchaseAmount || !maxDiscount || !usageLimit){
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
    
    if(minPurchaseAmount<400){
      return res.status(400).json({success:false,message:'Minimum purchase amount cannot be less than 400'})
    }
    if(discountType==='percentage' && discountValue>80){
      return res.status(400).json({success:false,message:'discountvalue in percentage in not greterthan 80'})
    }
    // Check for discount type and validate based on it
    if (discountType === 'percentage') {
      if (discountValue <= 0 || discountValue > 80) {
        return res.status(400).json({ success: false, message: 'Percentage discount value should be between 1 and 80' });
      }
      
    } else if (discountType === 'fixed') {
      if (discountValue <= 0 || discountValue > maxDiscount) {
        return res.status(400).json({ success: false, message: 'Fixed discount value cannot exceed max discount' });
      }
    }
    
    // Global max discount check for both types
    if (maxDiscount > 10000) {
      return res.status(400).json({ success: false, message: 'Maximum discount cannot be greater than 10000' });
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
    const validDiscountTypes = ['percentage', 'fixed'];
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
      maxDiscount:maxDiscount,
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
    const offers = await Offer.find({});
    // if (!offers || offers.length === 0) {
    //   return res.status(400).json({ success: false, message: 'Offers not found' });
    // }
    res.render('adminoffer/offer', { offers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/offers/add-offer', async (req, res) => {
  try {
    const products = await Product.find({});
    const categories = await Category.find({});
    res.render('adminoffer/addoffer', { products, categories });
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

    // Validate input fields
    if (!offerName || !offerType || !discountType || !discountValue || !startDate || !endDate || !offerStatus || !offerDescription) {
      return res.status(400).json({ success: false, message: 'Please fill all the fields' });
    }
    const regex = /^[A-Z0-9]+$/;
    if(!regex.test(offerName)){
      return res.status(400).json({success:false,message:'Only capital and numbers'})
    }
    // Check if the offer type is valid
    const validOfferTypes = ['product', 'category'];
    if (!validOfferTypes.includes(offerType)) {
      return res.status(400).json({ success: false, message: 'Invalid offer type' });
    }

    // Check if the discount type is valid
    const validDiscountTypes = ['percentage', 'fixed'];
    if (!validDiscountTypes.includes(discountType)) {
      return res.status(400).json({ success: false, message: 'Invalid discount type' });
    }

    // Validate discountValue
    if (discountValue <= 0) {
      return res.status(400).json({ success: false, message: 'Discount value must be greater than zero' });
    }

    // Validate startDate and endDate
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({ success: false, message: 'End date must be after start date' });
    }

    // Validate offerStatus
    const validStatuses = ['active', 'inactive'];
    if (!validStatuses.includes(offerStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid offer status' });
    }

    // Validate product selection if offerType is 'product'
    if (offerType === 'product' && productSelection.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one product' });
    }

    // Validate category selection if offerType is 'category'
    if (offerType === 'category' && categorySelection.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one category' });
    }

    const existingOffers = await Offer.find({
      offerName: offerName // Adjusted to check exact match
  });
  
  if (existingOffers.length > 0) {
      return res.status(400).json({ success: false, message: 'An offer with this name already exists.' });
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
      productIds: productSelection,
      categoryIds: categorySelection
    });

    // Function to calculate the final price based on the discount type
    const calculateFinalPrice = (productPrice, discountType, discountValue) => {
      return discountType === 'percentage'
        ? productPrice - (productPrice * (discountValue / 100))
        : productPrice - discountValue;
    };

    // Check if the new offer provides a better price
    const applyBestOffer = async (product, discountType, discountValue) => {
      const newFinalPrice = calculateFinalPrice(product.price, discountType, discountValue);
      if (product.finalPrice === undefined || newFinalPrice < product.finalPrice) {
        product.finalPrice = Math.max(newFinalPrice, 0);
        product.offerApplied = true;
        await product.save();
      }
    };

    // Update products from productSelection (if offerType is 'product')
    if (offerType === 'product') {
      const productsWithOffers = await Product.find({ _id: { $in: productSelection } });
      for (const product of productsWithOffers) {
        await applyBestOffer(product, discountType, discountValue);
      }
    }

    // Update products in categorySelection (if offerType is 'category')
    if (offerType === 'category') {
      const productsInCategories = await Product.find({ category: { $in: categorySelection } });
      for (const product of productsInCategories) {
        await applyBestOffer(product, discountType, discountValue);
      }
    }

    // Save the offer
    await offer.save();
    res.status(200).json({ success: true, message: 'Offer created successfully' });

  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({ success: false, message: error.message });
  }
});


router.get('/offers/edit-offer/:id', async (req, res) => {
  try {
      const offerId = req.params.id;
      const offer = await Offer.findById(offerId); // Get the offer

      if (!offer) {
          return res.status(404).json({ success: false, message: 'Offer not found' });
      }

      // Fetch all products and categories to populate the select options
      const products = await Product.find(); // Adjust this line if your product fetching logic is different
      const categories = await Category.find(); // Fetch categories if needed

      res.render('adminoffer/editoffer', {
          offer,
          products,    // Pass products to the template
          categories   // Pass categories if needed
      });
  } catch (error) {
      res.status(500).json({ success: false, message: error.message });
  }
});

// Route to handle the offer update
// Route to handle the offer update
router.post('/offers/edit-offer/:id', async (req, res) => {
  try {
      const offerId = req.params.id;
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

      // Fetch the existing offer
      const existingOffer = await Offer.findById(offerId);
      if (!existingOffer) {
          return res.status(404).json({ success: false, message: 'Offer not found' });
      }

      // Update offer fields
      existingOffer.offerName = offerName;
      existingOffer.offerType = offerType;
      existingOffer.discountType = discountType;
      existingOffer.discountValue = discountValue;
      existingOffer.startDate = new Date(startDate);
      existingOffer.endDate = new Date(endDate);
      existingOffer.offerStatus = offerStatus;
      existingOffer.offerDescription = offerDescription;

      // Update productIds or categoryIds based on the selected offer type
      if (offerType === 'product') {
          existingOffer.productIds = productSelection;
          existingOffer.categoryIds = []; // Clear categories if the offer is a product
      } else if (offerType === 'category') {
          existingOffer.categoryIds = categorySelection;
          existingOffer.productIds = []; // Clear products if the offer is a category
      }

      await existingOffer.save();

      // Additional logic to update products if needed...

      res.redirect('/offers'); // Redirect to the offers page after the update

  } catch (error) {
      res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/offers/delete-offer/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;

    // Find the offer by ID
    const offer = await Offer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    // Reset finalPrice and offerApplied for products associated with this offer
    const productIds = offer.offerType === 'product' ? offer.productIds : null;
    const categoryIds = offer.offerType === 'category' ? offer.categoryIds : null;

    // Check for any other active offers on the products
    const activeOffers = await Offer.find({
      _id: { $ne: offerId }, // Exclude the current offer
      status: 'active', // Assuming there is a 'status' field to check if the offer is active
      ...(productIds ? { productIds: { $in: productIds } } : { categoryIds: { $in: categoryIds } })
    });

    const hasActiveOffers = activeOffers.length > 0;

    // Update products associated with this offer
    if (productIds) {
      await Product.updateMany(
        { _id: { $in: productIds } },
        [
          {
            $set: {
              finalPrice: hasActiveOffers ? { $ifNull: [{ $arrayElemAt: [activeOffers.offerPrice, 0] }, "$price"] } : "$price",
              offerApplied: hasActiveOffers // Set to true if there are active offers, false otherwise
            }
          }
        ]
      );
    } else if (categoryIds) {
      await Product.updateMany(
        { category: { $in: categoryIds } },
        [
          {
            $set: {
              finalPrice: hasActiveOffers ? { $ifNull: [{ $arrayElemAt: [activeOffers.offerPrice, 0] }, "$price"] } : "$price",
              offerApplied: hasActiveOffers // Set to true if there are active offers, false otherwise
            }
          }
        ]
      );
    }

    // Delete the offer
    await Offer.findByIdAndDelete(offerId);
    // res.status(200).json({ success: true, message: 'Offer deleted successfully and products updated' });
    res.status(200).redirect('/admin/offers')

  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ success: false, message: 'An error occurred while deleting the offer.' });
  }
});




module.exports=router;