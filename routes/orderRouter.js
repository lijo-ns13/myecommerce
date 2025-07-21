const express = require('express');
const router = express.Router();
const Order = require('../models/orderSchema');
const User=require('../models/userSchema')
const Product = require('../models/productSchema');
const { jwtAuth, userProtected } = require('../middlewares/auth');
const orderController=require('../controllers/orderController');
const PDFDocument = require('pdfkit');
const path=require('path')
// Apply JWT authentication and protect the routes
router.use(jwtAuth, userProtected);

// Route to get the list of orders for a user
router.get('/',orderController.getOrders);
// /user/orders/<%= order._id %>
router.get('/:orderId',orderController.getOrderDetailed)

// Route to cancel an order
router.post('/:orderId/cancel', orderController.postOrderCancel);

// /user/orders/return/<%=order._id%>

router.get('/return/:orderId',orderController.getReturnOrderId)
router.post('/return/:orderId',orderController.postReturnOrderId)




// dowload invoice
router.get('/download-invoice/:orderId', orderController.getInvoiceDowload);


// cancel single product
// /user/orders/cancelsingle/<%=order._id%>/<%=orderData.productId%>
router.post('/cancelsingle/:orderId/:productId/:productSize/:productQuantity', orderController.postCancelSingleProduct);



module.exports = router;
