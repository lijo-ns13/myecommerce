const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
const verifyPayment = async (req, res) => {
  const { orderId, paymentId, signature } = req.body;

  console.log('Verifying payment:');
  console.log('Order ID:', orderId);
  console.log('Payment ID:', paymentId);
  console.log('Received Signature:', signature);

  const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
  hmac.update(`${orderId}|${paymentId}`); // Ensure correct concatenation
  const generatedSignature = hmac.digest('hex');

  console.log('Generated signature:', generatedSignature);

  if (generatedSignature === signature) {
    console.log(`Payment verified for orderId: ${orderId}`);
    return res.json({ success: true });
  } else {
    console.error('Payment verification failed for orderId:', orderId, signature);
    return res
      .status(httpStatusCodes.BAD_REQUEST)
      .json({ success: false, message: 'Payment verification failed' });
  }
};
const updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    const order = await Order.findById(orderId); // Assuming products is an array of { productId, quantity, size }

    if (!order) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Order not found' });
    }

    // Store product restock info immediately for rollback
    const productRestockInfo = order.products.map((item) => ({
      productId: item.productId, // Assuming productId is stored in the product object
      size: item.size, // Assuming each order item has a size
      quantity: item.quantity,
    }));

    const previousStatus = order.status;

    // Update order status
    order.status = status;

    // If the order status is failed, restock the products only if not coming from pending
    let shouldRestock = false;
    if (status === 'payment_failed' && previousStatus !== 'pending') {
      shouldRestock = true;
    } else if (status === 'payment_failed') {
      // Mark products as cancelled
      order.products.forEach((product) => {
        product.status = 'cancelled';
      });
      order.orderedProducts.forEach((product) => {
        product.status = 'cancelled';
      });
    }

    // Save the order
    await order.save();

    if (shouldRestock) {
      const productsToUpdate = await Product.find({
        _id: { $in: productRestockInfo.map((info) => info.productId) },
      });

      await Promise.all(
        productsToUpdate.map(async (product) => {
          const sizeInfo = productRestockInfo.find((info) => {
            console.log(
              'infoproductid',
              info.productId,
              'productid',
              product._id,
              typeof info.productId,
              typeof product._id
            );
            return info.productId.equals(product._id);
          });
          if (sizeInfo) {
            const sizeEntry = product.sizes.find((s) => {
              console.log(
                's.size',
                s.size,
                'sizeInfo',
                sizeInfo.size,
                typeof s.size,
                typeof sizeInfo.size
              );
              return s.size.toString() === sizeInfo.size.toString();
            });
            if (sizeEntry) {
              sizeEntry.stock += sizeInfo.quantity; // Increase stock for the specific size
              await product.save();
            } else {
              console.error(`Size ${sizeInfo.size} not found for product ID: ${product._id}`);
            }
          }
        })
      );
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error updating order status:', error);

    await Promise.all(
      productRestockInfo.map(async ({ productId, size, quantity }) => {
        const product = await Product.findById(productId);
        if (product) {
          const sizeEntry = product.sizes.find((s) => s.size === size);
          if (sizeEntry) {
            sizeEntry.stock += quantity; // Rollback by increasing the stock
            await product.save();
          }
        }
      })
    );

    return res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'Failed to update order status' });
  }
};
const createOrder = async (req, res) => {
  const { amount, orderId } = req.body; // Accept orderId in request
  const options = {
    amount: amount * 100,
    currency: 'INR',
    receipt: orderId,
    payment_capture: 1,
  };

  try {
    const order = await razorpay.orders.create(options);
    res.json({ razorpayOrderId: order.id, orderId: orderId });
  } catch (error) {
    console.error(error);
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).send('Error creating order');
  }
};
const verifyPaymentTwo = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res
      .status(httpStatusCodes.BAD_REQUEST)
      .json({ success: false, message: 'Invalid input data.' });
  }

  try {
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature === razorpay_signature) {
      const order = await Order.findById(order_id);
      if (!order) {
        return res
          .status(httpStatusCodes.NOT_FOUND)
          .json({ success: false, message: 'Order not found.' });
      }

      // Update order status to processing
      order.status = 'processing';
      await order.save();

      // Decrement stock
      for (const item of order.products) {
        const product = await Product.findById(item.productId);
        if (product) {
          const sizeIndex = product.sizes.findIndex(
            (size) => size.size.toString() === item.size.toString()
          );
          if (sizeIndex !== -1) {
            product.sizes[sizeIndex].stock -= item.quantity;
            await product.save();
          }
        }
      }

      // Clear the cart
      await Cart.deleteOne({ userId: order.userId });

      return res.json({ success: true });
    } else {
      return res.json({
        success: false,
        message: 'Payment verification failed. Invalid signature.',
      });
    }
  } catch (err) {
    console.error('Payment verification error:', err);
    return res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'Payment verification error. Please try again later.' });
  }
};
module.exports = {
  verifyPayment,
  updateOrderStatus,
  createOrder,
  verifyPaymentTwo,
};
