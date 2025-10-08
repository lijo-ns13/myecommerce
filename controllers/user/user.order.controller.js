const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const PDFDocument = require('pdfkit');
const path = require('path');
const getOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get page & limit from query, default to page 1, 10 orders per page
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch total count for pagination
    const totalOrders = await Order.countDocuments({ userId });

    // Fetch orders with skip & limit, sorted by newest first
    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit);

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No orders found',
      });
    }

    // Pass paginated data to EJS template
    res.render('orders', {
      orders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

const postOrderCancel = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    const wallet = await Wallet.findOne({ userId: req.user._id });

    // Check if order exists
    if (!order) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Order not found' });
    }

    // Check if user is authorized to cancel
    if (order.userId.toString() !== req.user._id.toString()) {
      return res
        .status(httpStatusCodes.FORBIDDEN)
        .json({ success: false, message: 'Unauthorized' });
    }

    // Ensure the order can be cancelled
    const cancellableStatuses = ['pending', 'processing', 'shipped'];
    if (!cancellableStatuses.includes(order.status)) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Order cannot be cancelled' });
    }

    // Update the order status
    order.status = 'cancelled';
    await order.save();

    // Rebuild stock levels for the products in the order
    const updatedProducts = [];
    for (const item of order.products) {
      const product = await Product.findById(item.productId);

      if (product) {
        // Find the size index for the existing size
        const sizeIndex = product.sizes.findIndex(
          (size) => size.size.toString() === item.size.toString()
        );

        if (sizeIndex !== -1) {
          // Update the stock for the existing size
          product.sizes[sizeIndex].stock += item.quantity;
        } else {
          // If the size does not exist, this part shouldn't trigger unnecessarily. Just for safety:
          console.error(`Size ${item.size} not found for product ${item.productId}`);
          return res
            .status(400)
            .json({ success: false, message: `Size ${item.size} not found for product` });
        }

        await product.save();
        updatedProducts.push({
          productId: product._id,
          size: item.size,
          newStock: product.sizes[sizeIndex]?.stock,
        });
      }
    }
    const transaction = {
      amount: order.totalPrice,
      type: 'credit',
      description: 'Amount from order canceled',
      date: new Date(),
    };
    console.log('trnas', transaction);
    console.log('orderpaymethod', order.paymentDetails.paymentMethod);
    if (order.paymentDetails.paymentMethod === 'razorpay') {
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'user not found' });
      }
      if (wallet) {
        // Add transaction and update balance if wallet exists
        wallet.balance += order.totalPrice;
        wallet.transactions.push(transaction);
        await wallet.save();
      } else {
        // Create a new wallet if one doesn't exist
        const newWallet = new Wallet({
          userId: req.user._id,
          balance: order.totalPrice,
          transactions: [transaction], // Ensure this is an array of objects
        });
        await newWallet.save();
        user.walletId = newWallet._id;
        await user.save();
      }
      return res.status(httpStatusCodes.OK).json({
        success: true,
        message: 'Order cancelled successfully and amount credited to wallet',
      });
    }

    res
      .status(httpStatusCodes.OK)
      .json({ success: true, message: 'Order successfully cancelled', updatedProducts });
  } catch (error) {
    console.error('Error during cancellation:', error);
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};

const getOrderDetailed = async (req, res) => {
  const orderId = req.params.orderId;
  const order = await Order.findById(orderId);
  if (!order) {
    return res
      .status(httpStatusCodes.BAD_REQUEST)
      .json({ success: false, message: 'Order not found' });
  }

  // Format the delivery date
  const deliveryDate = new Date(order.deliveryDate).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });

  // Pass the formatted delivery date to the template
  res.render('orderDetailed', { order, deliveryDate });
};
const getReturnOrderId = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'order not found' });
    }
    res.status(httpStatusCodes.OK).render('return', { order });
  } catch (error) {
    console.log('error in get return', error.message);
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
const postReturnOrderId = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { reason } = req.body;
    const order = await Order.findById(orderId);
    if (!reason) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'please provide a reason' });
    }
    if (!orderId) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'order id is required' });
    }
    if (!order) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'order not found' });
    }
    order.status = 'pending_return';
    order.returnReason = reason;
    await order.save();
    // res.status(200).json({success:false,message:'order return process started'})\
    res.status(httpStatusCodes.OK).redirect(`/user/orders/${orderId}`);
  } catch (error) {
    console.log('error in post return', error.message);
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
const generateInvoice = (order, userName) => {
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
    const logoPath = path.join(__dirname, '../../public', 'img', 'logo.png');

    // Colors
    const primaryColor = '#4a86e8';
    const textColor = '#333333';

    // Header
    doc
      .image(logoPath, 50, 45, { width: 60 })
      .fillColor(primaryColor)
      .fontSize(28)
      .text('STRIDNEST', 120, 65)
      .fontSize(10)
      .text('123 Business Road, Business City, 12345', 120, 95)
      .text('Phone: 8921580213', 120, 110)
      .text('Email: info@stridnest.com', 120, 125);

    // Invoice number (moved to the right side)
    doc.fontSize(12).text(`Invoice Number: INV-${order._id}`, 350, 65, { align: 'right' });

    drawLine(50, 140, doc.page.width - 50, 140, primaryColor);

    // Invoice title
    doc.fillColor(textColor).fontSize(24).text('INVOICE', 50, 160);

    // Customer and order information
    doc
      .fillColor(textColor)
      .fontSize(12)
      .text('Bill To:', 50, 200)
      .fontSize(10)
      .text(`${userName}`, 50, 215)
      .text(`${order.shippingAddress.street}`, 50, 230)
      .text(
        `${order.shippingAddress.city}, ${order.shippingAddress.state}, ${order.shippingAddress.postalCode}`,
        50,
        245
      )
      .text(`${order.shippingAddress.country}`, 50, 260)
      .text(`Phone: ${order.shippingAddress.phoneNo}`, 50, 275);

    doc
      .fontSize(10)
      .text('Order Date:', 300, 200)
      .text('Due Date:', 300, 215)
      .text('Customer ID:', 300, 230)
      .text('Order ID', 300, 245);
    doc
      .fontSize(10)
      .text(`${new Date(order.orderDate).toLocaleDateString()}`, 400, 200)
      .text(`${new Date(order.deliveryDate).toLocaleDateString()}`, 400, 215)
      .text(`${order.userId}`, 400, 230)
      .text(`${order.genOrderId}`, 400, 245);

    // Invoice table
    const invoiceTop = 290;
    drawLine(50, invoiceTop, doc.page.width - 50, invoiceTop, primaryColor);
    doc
      .fillColor(primaryColor)
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
      doc
        .text(truncatedName, 60, position)
        .text(item.productQuantity.toString(), 250, position)
        .text(item.productPrice.toFixed(2), 350, position)
        .text((item.productQuantity * item.productPrice).toFixed(2), 450, position);
      position += 20;
      drawLine(50, position, doc.page.width - 50, position, '#e0e0e0');
      position += 5;
    });
    // Before total
    if (order.isDiscount) {
      doc
        .fontSize(12)
        .text('Discount:', 350, position + 10)
        .fillColor(primaryColor)
        .fontSize(14)
        .text(`${order.discount.toFixed(2)}`, 450, position + 10);
      position += 20; // Move position for total below discount
    }

    // Total
    doc
      .fontSize(12)
      .text('Total Amount:', 350, position + 10)
      .fillColor(primaryColor)
      .fontSize(14)
      .text(`${order.totalPrice.toFixed(2)}`, 450, position + 10);

    // Footer
    const footerTop = doc.page.height - 50;
    drawLine(50, footerTop, doc.page.width - 50, footerTop, primaryColor);
    doc
      .fillColor(primaryColor)
      .fontSize(10)
      .text('Thank you for your business!', 50, footerTop + 10, { align: 'center', width: 500 })
      .text('For any inquiries, please contact us at support@stridnest.com', 50, footerTop + 25, {
        align: 'center',
        width: 500,
      });

    doc.end();
  });
};
const getInvoiceDowload = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.user._id; // Ensure you have user authentication middleware
    const order = await Order.findById(orderId);
    const user = await User.findById(userId);
    const userName = user.name;

    if (!order) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Order not found' });
    }

    // Optionally check if the user owns the order
    if (order.userId.toString() !== userId.toString()) {
      return res
        .status(httpStatusCodes.FORBIDDEN)
        .json({ success: false, message: 'Unauthorized to access this invoice' });
    }

    // Generate the invoice here
    const invoiceBuffer = await generateInvoice(order, userName);

    // Set the headers to prompt a file download
    res.setHeader('Content-Disposition', 'attachment; filename="invoice.pdf"');
    res.setHeader('Content-Type', 'application/pdf');

    // Send the invoice buffer as a response
    res.send(invoiceBuffer);
  } catch (error) {
    console.error('Error on downloading invoice:', error);
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
const postCancelSingleProduct = async (req, res) => {
  try {
    const { orderId, productId, productSize, productQuantity } = req.params;

    // 1️⃣ Fetch the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Order not found' });
    }

    // 2️⃣ Ensure more than one product exists
    if (order.products.length <= 1) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message:
          'You can’t cancel a single product in a single-item order. Cancel the entire order instead.',
      });
    }

    // 3️⃣ Fetch the product
    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Product not found' });
    }

    // 4️⃣ Check order status
    const cancellableStatuses = ['pending', 'processing', 'shipped'];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'This product cannot be cancelled after delivery.',
      });
    }

    // 5️⃣ Find the product in orderedProducts
    const orderedProduct = order.orderedProducts.find(
      (p) =>
        p.productId.toString() === productId.toString() &&
        p.productSize.toString() === productSize.toString()
    );

    if (!orderedProduct) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Product not found in this order' });
    }

    // 6️⃣ Calculate refund amount properly (price * quantity)
    const refundAmount = orderedProduct.productPrice * orderedProduct.productQuantity;

    // 7️⃣ Update order pricing
    order.originalPrice -= refundAmount;
    order.totalPrice -= refundAmount;

    // Optional: Adjust discount proportionally if order has discount
    if (order.isDiscount && order.discount) {
      const totalBefore = order.originalPrice + refundAmount; // original total before cancel
      const discountRatio = order.discount / totalBefore; // e.g., 10% of original
      const discountReduction = refundAmount * discountRatio;
      order.discount -= discountReduction;
      order.totalPrice -= discountReduction; // subtract discount portion from totalPrice
    }

    // 8️⃣ Remove product from order arrays
    order.products = order.products.filter(
      (p) => !(p.productId.toString() === productId && p.size.toString() === productSize)
    );
    order.orderedProducts = order.orderedProducts.filter(
      (p) => !(p.productId.toString() === productId && p.productSize.toString() === productSize)
    );

    // 9️⃣ Update product stock
    const sizeToUpdate = product.sizes.find((s) => s.size.toString() === productSize.toString());
    if (sizeToUpdate) {
      sizeToUpdate.stock += parseInt(productQuantity, 10);
      await product.save();
    }

    // 🔟 Refund logic for Razorpay or Wallet
    if (['razorpay', 'wallet'].includes(order.paymentDetails.paymentMethod)) {
      let wallet = await Wallet.findOne({ userId: order.userId });

      if (!wallet) {
        wallet = new Wallet({
          userId: order.userId,
          balance: refundAmount,
          transactions: [
            {
              amount: refundAmount,
              type: 'credit',
              description: `Refund for cancelled product in order ${order._id}`,
            },
          ],
        });
      } else {
        wallet.balance += refundAmount;
        wallet.transactions.push({
          amount: refundAmount,
          type: 'credit',
          description: `Refund for cancelled product in order ${order._id}`,
        });
      }

      await wallet.save();
    }

    // 1️⃣1️⃣ Save updated order
    await order.save();

    res.status(httpStatusCodes.OK).json({
      success: true,
      message: 'Successfully cancelled product and refunded to wallet if applicable',
    });
  } catch (error) {
    console.error('Error on cancel single product:', error);
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};

// const postCancelSingleProduct = async (req, res) => {
//   try {
//     const { orderId, productId, productSize, productQuantity } = req.params;

//     // 1️⃣ Fetch the order
//     const order = await Order.findById(orderId);
//     if (!order) {
//       return res
//         .status(httpStatusCodes.NOT_FOUND)
//         .json({ success: false, message: 'Order not found' });
//     }

//     // 2️⃣ Ensure more than one product exists
//     if (order.products.length <= 1) {
//       return res.status(httpStatusCodes.BAD_REQUEST).json({
//         success: false,
//         message:
//           'You can’t cancel a single product in a single-item order. Cancel the entire order instead.',
//       });
//     }

//     // 3️⃣ Fetch the product
//     const product = await Product.findById(productId);
//     if (!product) {
//       return res
//         .status(httpStatusCodes.NOT_FOUND)
//         .json({ success: false, message: 'Product not found' });
//     }

//     // 4️⃣ Check order status before allowing cancel
//     const cancellableStatuses = ['pending', 'processing', 'shipped']; // delivered cannot be canceled
//     if (!cancellableStatuses.includes(order.status)) {
//       return res.status(httpStatusCodes.BAD_REQUEST).json({
//         success: false,
//         message: 'This product cannot be cancelled after delivery.',
//       });
//     }

//     // 5️⃣ Calculate final price of this product in the order
//     const orderedProduct = order.orderedProducts.find(
//       (p) =>
//         p.productId.toString() === productId.toString() &&
//         p.productSize.toString() === productSize.toString()
//     );

//     if (!orderedProduct) {
//       return res
//         .status(httpStatusCodes.BAD_REQUEST)
//         .json({ success: false, message: 'Product not found in this order' });
//     }

//     const finalPrice = orderedProduct.productPrice;
//     order.originalPrice -= finalPrice;
//     order.totalPrice -= finalPrice;

//     // 6️⃣ Remove the product from order arrays
//     order.products = order.products.filter(
//       (p) => !(p.productId.toString() === productId && p.size.toString() === productSize)
//     );
//     order.orderedProducts = order.orderedProducts.filter(
//       (p) => !(p.productId.toString() === productId && p.productSize.toString() === productSize)
//     );

//     // 7️⃣ Update product stock
//     const sizeToUpdate = product.sizes.find((s) => s.size.toString() === productSize.toString());
//     if (sizeToUpdate) {
//       sizeToUpdate.stock += parseInt(productQuantity, 10);
//       await product.save();
//     }

//     // 8️⃣ Refund logic for razorpay or wallet payments
//     if (['razorpay', 'wallet'].includes(order.paymentDetails.paymentMethod)) {
//       let wallet = await Wallet.findOne({ userId: order.userId });

//       if (!wallet) {
//         // create new wallet if not exists
//         wallet = new Wallet({
//           userId: order.userId,
//           balance: finalPrice,
//           transactions: [
//             {
//               amount: finalPrice,
//               type: 'credit',
//               description: `Refund for cancelled product in order ${order._id}`,
//             },
//           ],
//         });
//       } else {
//         // add money to existing wallet
//         wallet.balance += finalPrice;
//         wallet.transactions.push({
//           amount: finalPrice,
//           type: 'credit',
//           description: `Refund for cancelled product in order ${order._id}`,
//         });
//       }

//       await wallet.save();
//     }

//     // 9️⃣ Save the updated order
//     await order.save();

//     res.status(httpStatusCodes.OK).json({
//       success: true,
//       message: 'Successfully cancelled product and refunded to wallet if applicable',
//     });
//   } catch (error) {
//     console.error('Error on cancel single product:', error);
//     res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
//   }
// };

// const postCancelSingleProduct = async (req, res) => {
//   try {
//     const { orderId, productId, productSize, productQuantity } = req.params;

//     // Fetch the order by ID
//     const order = await Order.findById(orderId);
//     if (!order) {
//       return res
//         .status(httpStatusCodes.NOT_FOUND)
//         .json({ success: false, message: 'Order not found' });
//     }

//     // Ensure there are more than one product in the order
//     if (order.products.length <= 1) {
//       return res.status(httpStatusCodes.BAD_REQUEST).json({
//         success: false,
//         message:
//           'You can’t cancel a single product in a single item. Please cancel the entire order.',
//       });
//     }

//     // Fetch the product being canceled
//     const product = await Product.findById(productId);
//     if (!product) {
//       return res
//         .status(httpStatusCodes.NOT_FOUND)
//         .json({ success: false, message: 'Product not found' });
//     }
//     if (
//       order.paymentDetails.paymentMethod === 'razorpay' ||
//       order.paymentDetails.paymentMethod === 'wallet'
//     ) {
//       return res
//         .status(httpStatusCodes.BAD_REQUEST)
//         .json({ success: false, message: 'You cant cancel this order only after deliver' });
//     }
//     const productPrice = product.price; // Get the price of the product
//     order.originalPrice -= productPrice; // Adjust original price

//     let finalPrice = 0;

//     // Calculate finalPrice for ordered products
//     for (const orderedProduct of order.orderedProducts) {
//       if (
//         orderedProduct.productId.toString() === productId.toString() &&
//         orderedProduct.productSize.toString() === productSize.toString()
//       ) {
//         finalPrice += orderedProduct.productPrice; // Sum the price of matching products
//       }
//     }

//     order.totalPrice -= finalPrice; // Adjust the total price

//     // Remove the product from the products array based on productId and size
//     order.products = order.products.filter(
//       (orderProduct) =>
//         !(
//           orderProduct.productId.toString() === productId.toString() &&
//           orderProduct.size.toString() === productSize.toString()
//         )
//     );

//     // Remove the product from orderedProducts based on productId and productSize
//     order.orderedProducts = order.orderedProducts.filter(
//       (orderedProduct) =>
//         !(
//           orderedProduct.productId.toString() === productId.toString() &&
//           orderedProduct.productSize.toString() === productSize.toString()
//         )
//     );

//     // Update the product's stock
//     const sizeToUpdate = product.sizes.find(
//       (size) => size.size.toString() === productSize.toString()
//     );
//     if (sizeToUpdate) {
//       sizeToUpdate.stock += parseInt(productQuantity, 10); // Increment stock by the quantity of the canceled product
//     }

//     // Save the updated product stock
//     await product.save();

//     // Check if payment method is Razorpay and initiate refund to wallet
//     if (order.paymentDetails.paymentMethod === 'razorpay') {
//       const refundAmount = finalPrice; // Amount to be refunded
//       const user = await User.findById(order.userId); // Fetch the user to update wallet

//       if (user) {
//         user.walletBalance += refundAmount; // Add refund amount to user's wallet
//         await user.save(); // Save the updated wallet balance
//       } else {
//         return res
//           .status(httpStatusCodes.NOT_FOUND)
//           .json({ success: false, message: 'User not found for wallet refund' });
//       }
//     }

//     // Save the order after all updates
//     await order.save();

//     res.status(httpStatusCodes.OK).json({
//       success: true,
//       message: 'Successfully cancelled product and processed refund if applicable',
//     });
//   } catch (error) {
//     console.log('Error on cancel single product:', error.message);
//     res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
//   }
// };

module.exports = {
  getOrders,
  postOrderCancel,
  getOrderDetailed,
  getReturnOrderId,
  postReturnOrderId,
  getInvoiceDowload,
  postCancelSingleProduct,
};
