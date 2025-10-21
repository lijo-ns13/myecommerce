// paymentController.js
const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const mongoose = require('mongoose');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const verifyPaymentTwo = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res
      .status(httpStatusCodes.BAD_REQUEST)
      .json({ success: false, message: 'Invalid input data.' });
  }
  let order;
  try {
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    order = await Order.findById(order_id);
    if (!order) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Order not found.' });
    }

    if (generatedSignature === razorpay_signature) {
      order.status = 'processing';
      await order.save();

      await Cart.deleteOne({ userId: order.userId });

      return res.json({ success: true });
    } else {
      order.status = 'payment_failed';
      await order.save();

      for (const item of order.products) {
        const product = await Product.findById(item.productId);
        if (product) {
          const sizeIndex = product.sizes.findIndex(
            (size) => size.size.toString() === item.size.toString()
          );
          if (sizeIndex !== -1) {
            product.sizes[sizeIndex].stock += item.quantity;
            await product.save();
          }
        }
      }

      return res.json({
        success: false,
        message: 'Payment verification failed. Invalid signature. Stock restored.',
      });
    }
  } catch (err) {
    console.error('Payment verification error:', err);

    if (order && order.status !== 'payment_failed') {
      order.status = 'payment_failed';
      await order.save();
      for (const item of order.products) {
        const product = await Product.findById(item.productId);
        if (product) {
          const sizeIndex = product.sizes.findIndex(
            (size) => size.size.toString() === item.size.toString()
          );
          if (sizeIndex !== -1) {
            product.sizes[sizeIndex].stock += item.quantity;
            await product.save();
          }
        }
      }
    }

    return res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'Payment verification error. Please try again later.' });
  }
};

const updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Order not found' });
    }

    const productRestockInfo = order.products.map((item) => ({
      productId: item.productId,
      size: item.size,
      quantity: item.quantity,
    }));

    const previousStatus = order.status;
    order.status = status;

    let shouldRestock = false;
    if (status === 'payment_failed' && previousStatus !== 'pending') {
      shouldRestock = true;
    } else if (status === 'payment_failed') {
      order.products.forEach((product) => {
        product.status = 'cancelled';
      });
      order.orderedProducts.forEach((product) => {
        product.status = 'cancelled';
      });
    }

    await order.save();

    if (shouldRestock) {
      for (const info of productRestockInfo) {
        const product = await Product.findById(info.productId);
        if (product) {
          const sizeEntry = product.sizes.find((s) => s.size.toString() === info.size.toString());
          if (sizeEntry) {
            sizeEntry.stock += info.quantity;
            await product.save();
          } else {
            console.error(`Size ${info.size} not found for product ID: ${product._id}`);
          }
        }
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error updating order status:', error);

    for (const info of productRestockInfo) {
      const product = await Product.findById(info.productId);
      if (product) {
        const sizeEntry = product.sizes.find((s) => s.size.toString() === info.size.toString());
        if (sizeEntry) {
          sizeEntry.stock += info.quantity;
          await product.save();
        }
      }
    }

    return res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'Failed to update order status' });
  }
};

module.exports = {
  verifyPaymentTwo,
  updateOrderStatus,
};
