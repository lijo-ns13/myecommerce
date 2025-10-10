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

    if (!orders) {
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

    // Mark all products as cancelled
    order.products.forEach((product) => {
      product.status = 'cancelled';
    });
    order.orderedProducts.forEach((product) => {
      product.status = 'cancelled';
    });

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
// Helper function to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
};

// Helper function to calculate invoice totals
const getInvoiceTotals = (order, taxRate = 0) => {
  // Use only active products for subtotal calculation
  const subtotal =
    order.subtotalAfterOffers ||
    order.orderedProducts
      .filter((item) => item.status === 'active')
      .reduce((sum, item) => sum + item.productQuantity * item.finalUnitPrice, 0);

  const totalDiscount =
    (order.discount || 0) + (order.couponDiscount || 0) + (order.offerTotalDiscount || 0);

  const taxAmount = subtotal * (taxRate / 100);

  // Use stored totalPrice as fallback-safe final total
  const total = order.totalPrice ?? subtotal - totalDiscount + taxAmount;

  return { subtotal, totalDiscount, taxAmount, total };
};

// Helper function to truncate long text
const truncateText = (text, maxLength) => {
  if (text.length > maxLength) {
    return text.substring(0, maxLength - 3) + '...';
  }
  return text;
};

const generateInvoice = (order, userName, companyDetails = {}) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    let buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    // Colors
    const primaryColor = '#003087';
    const textColor = '#1a1a1a';
    const accentColor = '#e6e6e6';
    const cancelledColor = '#888888'; // Gray for cancelled items
    const REGULAR_FONT = 'Helvetica';
    const BOLD_FONT = 'Helvetica-Bold';

    // Fonts
    doc.font(REGULAR_FONT);

    // Company Details
    const defaultCompanyDetails = {
      name: 'STRIDNEST',
      address: '123 Business Road, Business City, 12345, India',
      phone: '+91-8921580213',
      email: 'info@stridnest.com',
      taxId: 'GSTIN: 12ABCDE1234F1Z5',
    };
    const company = { ...defaultCompanyDetails, ...companyDetails };

    // Header (Company Details, left-aligned)
    const companyX = 50;
    const companyWidth = 130;
    doc
      .font(BOLD_FONT)
      .fillColor(primaryColor)
      .fontSize(14)
      .text(truncateText(company.name, 25), companyX, 30, { width: companyWidth })
      .font(REGULAR_FONT)
      .fillColor(textColor)
      .fontSize(6)
      .text(truncateText(company.address, 50), companyX, 45, { width: companyWidth })
      .text(`Phone: ${truncateText(company.phone, 15)}`, companyX, 53, { width: companyWidth })
      .text(`Email: ${truncateText(company.email, 25)}`, companyX, 61, { width: companyWidth })
      .text(truncateText(company.taxId, 20), companyX, 69, { width: companyWidth });

    // Invoice Metadata (right-aligned)
    const metadataX = doc.page.width - 110;
    const metadataWidth = 60;
    const metadataYStart = 30;
    doc
      .font(BOLD_FONT)
      .fillColor(textColor)
      .fontSize(6)
      .text(`Invoice # INV-${truncateText(order._id.toString(), 15)}`, metadataX, metadataYStart, {
        width: metadataWidth,
        align: 'right',
      })
      .text(`Order ID: ${truncateText(order.genOrderId, 15)}`, metadataX, metadataYStart + 16, {
        width: metadataWidth,
        align: 'right',
      })
      .text(
        `Date: ${new Date(order.orderDate).toLocaleDateString('en-IN')}`,
        metadataX,
        metadataYStart + 32,
        { width: metadataWidth, align: 'right' }
      )
      .text(
        `Due Date: ${new Date(order.deliveryDate).toLocaleDateString('en-IN')}`,
        metadataX,
        metadataYStart + 48,
        { width: metadataWidth, align: 'right' }
      );

    // Title
    doc
      .font(BOLD_FONT)
      .fillColor(primaryColor)
      .fontSize(28)
      .text('INVOICE', 0, 140, { align: 'center' });

    // Line Separator
    const drawLine = (startX, startY, endX, endY, color = primaryColor) => {
      doc.strokeColor(color).lineWidth(1).moveTo(startX, startY).lineTo(endX, endY).stroke();
    };
    drawLine(50, 170, doc.page.width - 50, 170);

    // Billing Information
    doc
      .font(BOLD_FONT)
      .fillColor(textColor)
      .fontSize(12)
      .text('Bill To:', 50, 190)
      .font(REGULAR_FONT)
      .fontSize(10)
      .text(userName, 50, 210)
      .text(order.shippingAddress.street, 50, 225)
      .text(
        `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}`,
        50,
        240
      )
      .text(order.shippingAddress.country, 50, 255)
      .text(`Phone: ${order.shippingAddress.phoneNo}`, 50, 270);

    // Items Table
    const tableTop = 300;
    const tableWidth = doc.page.width - 100;
    const col1Width = tableWidth * 0.5;
    const col2Width = tableWidth * 0.15;
    const col3Width = tableWidth * 0.2;
    const col4Width = tableWidth * 0.15;

    // Table Header
    drawLine(50, tableTop, doc.page.width - 50, tableTop);
    doc
      .font(BOLD_FONT)
      .fillColor(primaryColor)
      .fontSize(10)
      .text('Description', 50, tableTop + 10, { width: col1Width, align: 'left' })
      .text('Qty', 50 + col1Width + 10, tableTop + 10, { width: col2Width - 20, align: 'right' })
      .text('Unit Price', 50 + col1Width + col2Width + 10, tableTop + 10, {
        width: col3Width - 20,
        align: 'right',
      })
      .text('Amount', 50 + col1Width + col2Width + col3Width + 10, tableTop + 10, {
        width: col4Width - 20,
        align: 'right',
      });
    drawLine(50, tableTop + 25, doc.page.width - 50, tableTop + 25);

    // List Items (Option 2: Show all products, marking cancelled ones)
    let position = tableTop + 35;
    doc.font(REGULAR_FONT).fillColor(textColor).fontSize(10);
    order.orderedProducts.forEach((item) => {
      const isCancelled = item.status === 'cancelled';
      const amount = isCancelled ? 0 : item.productQuantity * item.finalUnitPrice;
      const displayName = isCancelled
        ? `${truncateText(item.productName, 25)} (Cancelled)`
        : truncateText(item.productName, 30);
      doc
        .fillColor(isCancelled ? cancelledColor : textColor)
        .text(displayName, 50, position, { width: col1Width - 10, align: 'left' })
        .text(isCancelled ? '-' : item.productQuantity, 50 + col1Width + 10, position, {
          width: col2Width - 20,
          align: 'right',
        })
        .text(
          isCancelled ? '-' : formatCurrency(item.finalUnitPrice),
          50 + col1Width + col2Width + 10,
          position,
          { width: col3Width - 20, align: 'right' }
        )
        .text(formatCurrency(amount), 50 + col1Width + col2Width + col3Width + 10, position, {
          width: col4Width - 20,
          align: 'right',
        });
      position += 20;
    });

    drawLine(50, position, doc.page.width - 50, position, accentColor);

    // Summary
    position += 20;
    const summaryX = doc.page.width - 180;
    const labelWidth = 80;
    const valueWidth = 80;
    const summaryValueX = summaryX + labelWidth + 10;

    const taxRate = 0;
    const { subtotal, totalDiscount, taxAmount, total } = getInvoiceTotals(order, taxRate);

    doc
      .font(BOLD_FONT)
      .fillColor(textColor)
      .fontSize(10)
      .text('Subtotal:', summaryX, position, { width: labelWidth, align: 'right' })
      .font(REGULAR_FONT)
      .text(formatCurrency(subtotal), summaryValueX, position, {
        width: valueWidth,
        align: 'right',
      });
    position += 15;

    if (order.isDiscount && totalDiscount > 0) {
      doc
        .font(BOLD_FONT)
        .text('Discount:', summaryX, position, { width: labelWidth, align: 'right' })
        .font(REGULAR_FONT)
        .text(`-${formatCurrency(totalDiscount)}`, summaryValueX, position, {
          width: valueWidth,
          align: 'right',
        });
      position += 15;
    }

    doc
      .font(BOLD_FONT)
      .text(`GST (${taxRate}%):`, summaryX, position, { width: labelWidth, align: 'right' })
      .font(REGULAR_FONT)
      .text(formatCurrency(taxAmount), summaryValueX, position, {
        width: valueWidth,
        align: 'right',
      });
    position += 15;

    doc
      .font(BOLD_FONT)
      .fontSize(12)
      .fillColor(primaryColor)
      .text('Total:', summaryX, position, { width: labelWidth, align: 'right' })
      .font(REGULAR_FONT)
      .text(formatCurrency(total), summaryValueX, position, { width: valueWidth, align: 'right' });

    // Footer
    const footerTop = doc.page.height - 100;
    drawLine(50, footerTop, doc.page.width - 50, footerTop);
    doc
      .font(REGULAR_FONT)
      .fillColor(primaryColor)
      .fontSize(10)
      .text('Thank you for your business!', 0, footerTop + 15, {
        align: 'center',
        width: doc.page.width,
      })
      .text(
        'For inquiries, contact us at support@stridnest.com or +91-8921580213',
        0,
        footerTop + 30,
        {
          align: 'center',
          width: doc.page.width,
        }
      );

    doc.end();
  });
};
const getInvoiceDowload = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.user._id;
    const order = await Order.findById(orderId).populate('userId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.userId._id.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ success: false, message: 'Unauthorized to access this invoice' });
    }

    const userName = order.userId.name;
    const invoiceBuffer = await generateInvoice(order, userName);

    res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.genOrderId}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(invoiceBuffer);
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};
const postCancelSingleProduct = async (req, res) => {
  try {
    const { orderId, productId, productSize } = req.params; // Removed productQuantity from params, as it's in the order

    // 1️⃣ Fetch the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Order not found' });
    }

    // 2️⃣ Check if more than one active product exists
    const activeProducts = order.products.filter((p) => p.status === 'active');
    if (activeProducts.length <= 1) {
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

    if (!orderedProduct || orderedProduct.status !== 'active') {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Product not found or already cancelled in this order' });
    }

    // 6️⃣ Mark as cancelled in orderedProducts and products
    orderedProduct.status = 'cancelled';
    const orderProduct = order.products.find(
      (p) =>
        p.productId.toString() === productId.toString() &&
        p.size.toString() === productSize.toString()
    );
    if (orderProduct) {
      orderProduct.status = 'cancelled';
    }

    // 7️⃣ Calculate amounts (assuming productPrice is original unit price)
    const itemOriginalTotal = orderedProduct.productPrice * orderedProduct.productQuantity;
    const itemOfferDiscount = orderedProduct.offerDiscountPerUnit * orderedProduct.productQuantity;
    const itemSubtotalAfterOffer = orderedProduct.finalUnitPrice * orderedProduct.productQuantity;

    // 8️⃣ Prorate coupon discount (only if coupon was applied)
    let proratedCoupon = 0;
    if (order.couponDiscount > 0 && order.subtotalAfterOffers > 0) {
      proratedCoupon = (itemSubtotalAfterOffer / order.subtotalAfterOffers) * order.couponDiscount;
    }

    // 9️⃣ Calculate refund (net amount after prorated coupon)
    const refund = itemSubtotalAfterOffer - proratedCoupon;

    // 🔟 Update order fields
    order.originalPrice -= itemOriginalTotal;
    order.subtotalAfterOffers -= itemSubtotalAfterOffer;
    order.offerTotalDiscount -= itemOfferDiscount;
    order.couponDiscount -= proratedCoupon;
    order.discount -= itemOfferDiscount + proratedCoupon;
    order.totalPrice -= refund;

    // 1️⃣1️⃣ Update product stock
    const sizeToUpdate = product.sizes.find((s) => s.size.toString() === productSize.toString());
    if (sizeToUpdate) {
      sizeToUpdate.stock += orderedProduct.productQuantity;
      await product.save();
    }

    // 1️⃣2️⃣ Refund logic for Razorpay or Wallet
    if (['razorpay', 'wallet'].includes(order.paymentDetails.paymentMethod)) {
      let wallet = await Wallet.findOne({ userId: order.userId });

      if (!wallet) {
        wallet = new Wallet({
          userId: order.userId,
          balance: refund,
          transactions: [
            {
              amount: refund,
              type: 'credit',
              description: `Refund for cancelled product in order ${order._id}`,
            },
          ],
        });
      } else {
        wallet.balance += refund;
        wallet.transactions.push({
          amount: refund,
          type: 'credit',
          description: `Refund for cancelled product in order ${order._id}`,
        });
      }

      await wallet.save();
    }

    // 1️⃣3️⃣ Save updated order
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

module.exports = {
  getOrders,
  postOrderCancel,
  getOrderDetailed,
  getReturnOrderId,
  postReturnOrderId,
  getInvoiceDowload,
  postCancelSingleProduct,
};
