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
router.get('/:orderId',async(req,res)=>{
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);
    if (!order) {
        return res.status(400).json({ success: false, message: 'Order not found' });
    }

    // Format the delivery date
    const deliveryDate = new Date(order.deliveryDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

    // Pass the formatted delivery date to the template
    res.render('orderDetailed', { order, deliveryDate });
})

// Route to cancel an order
router.post('/:orderId/cancel', orderController.postOrderCancel);

// /user/orders/return/<%=order._id%>

router.get('/return/:orderId',async(req,res)=>{
    try {
        const orderId=req.params.orderId;
        const order=await Order.findById(orderId);
        if(!order){
            return res.status(404).json({success:false,message:'order not found'})
        }
        res.status(200).render('return',{order})
    } catch (error) {
        console.log('error in get return',error.message);
        res.status(400).json({success:false,message:error.message})
    }
})
router.post('/return/:orderId',async(req,res)=>{
    try {
        const orderId=req.params.orderId;
        const {reason}=req.body;
        const order=await Order.findById(orderId);
        if(!reason){
            return res.status(400).json({success:false,message:'please provide a reason'})
        }
        if(!orderId){
            return res.status(400).json({success:false,message:'order id is required'})
        }
        if(!order){
            return res.status(400).json({success:false,message:'order not found'})
        }
        order.status='pending_return';
        order.returnReason=reason;
        await order.save();
        // res.status(200).json({success:false,message:'order return process started'})\
        res.status(200).redirect(`/user/orders/${orderId}`)

    } catch (error) {
        console.log('error in post return',error.message);
        res.status(400).json({success:false,message:error.message})
    }
})



const generateInvoice = (order,userName) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        let buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Helper functions
        const drawLine = (startX, startY, endX, endY, color = '#000000') => {
            doc.strokeColor(color).moveTo(startX, startY).lineTo(endX, endY).stroke();
        };

        // Text truncation function
        const truncateText = (text, width) => {
            let truncated = text;
            while (doc.widthOfString(truncated) > width) {
                truncated = truncated.slice(0, -1);
            }
            return truncated.length < text.length ? truncated.trim() + '...' : truncated;
        };

        // Set the path for the logo image
        const logoPath = path.join(__dirname, '../public', 'img', 'logo.png');

        // Colors
        const primaryColor = '#4a86e8';
        const textColor = '#333333';

        // Header
        doc.image(logoPath, 50, 45, { width: 60 })
           .fillColor(primaryColor)
           .fontSize(28)
           .text('STRIDNEST', 120, 65)
           .fontSize(10)
           .text('123 Business Road, Business City, 12345', 120, 95)
           .text('Phone: 8921580213', 120, 110)
           .text('Email: info@stridnest.com', 120, 125);

        // Invoice number (moved to the right side)
        doc.fontSize(12)
           .text(`Invoice Number: INV-${order._id}`, 350, 65, { align: 'right' });

        drawLine(50, 140, doc.page.width - 50, 140, primaryColor);

        // Invoice title
        doc.fillColor(textColor)
           .fontSize(24)
           .text('INVOICE', 50, 160);

        // Customer and order information
        doc.fillColor(textColor)
           .fontSize(12)
           .text('Bill To:', 50, 200)
           .fontSize(10)
           .text(`${userName}`, 50, 215)
           .text(`${order.shippingAddress.street}`, 50, 230)
           .text(`${order.shippingAddress.city}, ${order.shippingAddress.state}, ${order.shippingAddress.postalCode}`, 50, 245)
           .text(`${order.shippingAddress.country}`, 50, 260)
           .text(`Phone: ${order.shippingAddress.phoneNo}`, 50, 275);

        doc.fontSize(10)
           .text('Order Date:', 300, 200)
           .text('Due Date:', 300, 215)
           .text('Customer ID:', 300, 230);

        doc.fontSize(10)
           .text(`${new Date(order.orderDate).toLocaleDateString()}`, 400, 200)
           .text(`${new Date(order.deliveryDate).toLocaleDateString()}`, 400, 215)
           .text(`${order.userId}`, 400, 230);

        // Invoice table
        const invoiceTop = 290;
        drawLine(50, invoiceTop, doc.page.width - 50, invoiceTop, primaryColor);
        doc.fillColor(primaryColor)
           .fontSize(12)
           .text('Item', 60, invoiceTop + 10)
           .text('Quantity', 250, invoiceTop + 10)
           .text('Unit Price (INR)', 350, invoiceTop + 10)
           .text(`Amount (INR)`, 450, invoiceTop + 10);
        drawLine(50, invoiceTop + 30, doc.page.width - 50, invoiceTop + 30, primaryColor);

        let position = invoiceTop + 40;
        doc.fillColor(textColor).fontSize(10);
        order.orderedProducts.forEach((item, index) => {
            const truncatedName = truncateText(item.productName, 180); // Adjust width as needed
            doc.text(truncatedName, 60, position)
               .text(item.productQuantity.toString(), 250, position)
               .text(item.productPrice.toFixed(2), 350, position)
               .text((item.productQuantity * item.productPrice).toFixed(2), 450, position);
            position += 20;
            drawLine(50, position, doc.page.width - 50, position, '#e0e0e0');
            position += 5;
        });

        // Total
        doc.fontSize(12)
           .text('Total Amount:', 350, position + 10)
           .fillColor(primaryColor)
           .fontSize(14)
           .text(`${order.totalPrice.toFixed(2)}`, 450, position + 10);

        // Footer
        const footerTop = doc.page.height - 50;
        drawLine(50, footerTop, doc.page.width - 50, footerTop, primaryColor);
        doc.fillColor(primaryColor)
           .fontSize(10)
           .text('Thank you for your business!', 50, footerTop + 10, { align: 'center', width: 500 })
           .text('For any inquiries, please contact us at support@stridnest.com', 50, footerTop + 25, { align: 'center', width: 500 });

        doc.end();
    });
};
// dowload invoice
router.get('/download-invoice/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.user._id; // Ensure you have user authentication middleware
        const order = await Order.findById(orderId)
        const user=await User.findById(userId);
        const userName=user.name;

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Optionally check if the user owns the order
        if (order.userId.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized to access this invoice' });
        }

        // Generate the invoice here
        const invoiceBuffer = await generateInvoice(order,userName);

        // Set the headers to prompt a file download
        res.setHeader('Content-Disposition', 'attachment; filename="invoice.pdf"');
        res.setHeader('Content-Type', 'application/pdf');

        // Send the invoice buffer as a response
        res.send(invoiceBuffer);
    } catch (error) {
        console.error('Error on downloading invoice:', error);
        res.status(400).json({ success: false, message: error.message });
    }
});


// cancel single product
// /user/orders/cancelsingle/<%=order._id%>/<%=orderData.productId%>
router.post('/cancelsingle/:orderId/:productId/:productSize/:productQuantity', async (req, res) => {
    try {
        const { orderId, productId, productSize, productQuantity } = req.params;

        // Fetch the order by ID
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Ensure there are more than one product in the order
        if (order.products.length <= 1) {
            return res.status(400).json({ success: false, message: 'You can’t cancel a single product in a single item. Please cancel the entire order.' });
        }

        // Fetch the product being canceled
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const productPrice = product.price; // Get the price of the product
        order.originalPrice -= productPrice; // Adjust original price

        let finalPrice = 0;

        // Calculate finalPrice for ordered products
        for (const orderedProduct of order.orderedProducts) {
            if (orderedProduct.productId.toString() === productId.toString() &&
                orderedProduct.productSize.toString() === productSize.toString()) {
                finalPrice += orderedProduct.productPrice; // Sum the price of matching products
            }
        }

        order.totalPrice -= finalPrice; // Adjust the total price

        // Remove the product from the products array based on productId and size
        order.products = order.products.filter(orderProduct =>
            !(orderProduct.productId.toString() === productId.toString() &&
              orderProduct.size.toString() === productSize.toString())
        );

        // Remove the product from orderedProducts based on productId and productSize
        order.orderedProducts = order.orderedProducts.filter(orderedProduct =>
            !(orderedProduct.productId.toString() === productId.toString() &&
              orderedProduct.productSize.toString() === productSize.toString())
        );

        // Update the product's stock
        const sizeToUpdate = product.sizes.find(size => size.size.toString() === productSize.toString());
        if (sizeToUpdate) {
            sizeToUpdate.stock += parseInt(productQuantity, 10); // Increment stock by the quantity of the canceled product
        }

        // Save the updated product stock
        await product.save();

        // Check if payment method is Razorpay and initiate refund to wallet
        if (order.paymentDetails.paymentMethod === 'razorpay') {
            const refundAmount = finalPrice; // Amount to be refunded
            const user = await User.findById(order.userId); // Fetch the user to update wallet

            if (user) {
                user.walletBalance += refundAmount; // Add refund amount to user's wallet
                await user.save(); // Save the updated wallet balance
            } else {
                return res.status(404).json({ success: false, message: 'User not found for wallet refund' });
            }
        }

        // Save the order after all updates
        await order.save();

        res.status(200).json({ success: true, message: 'Successfully cancelled product and processed refund if applicable' });
    } catch (error) {
        console.log('Error on cancel single product:', error.message);
        res.status(400).json({ success: false, message: error.message });
    }
});



module.exports = router;
