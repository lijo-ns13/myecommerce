const Product = require('../../models/productSchema'); // Adjust the path to your Product model
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Wallet = require('../../models/walletSchema');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const nodemailer = require('nodemailer');

const getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page number
    const limit = parseInt(req.query.limit) || 10; // Number of orders per page
    const skip = (page - 1) * limit; // Calculate skip value

    const totalOrders = await Order.countDocuments(); // Total number of orders
    const totalPages = Math.ceil(totalOrders / limit); // Total number of pages

    const orders = await Order.find({})
      .skip(skip) // Skip the orders based on the current page
      .limit(limit) // Limit the number of orders returned
      .populate({
        path: 'userId',
        select: 'name',
      })
      .populate({
        path: 'products.productId',
        select: 'product',
      });

    res.render('adminorders/orders', {
      orders,
      currentPage: page,
      totalPages,
      currentPath: 'order',
    });
  } catch (error) {
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

const getEditOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Order not found' });
    }

    res.render('adminorders/edit', { order, currentPath: '/order' });
  } catch (error) {
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};
const postEditOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    console.log('status', status);
    const order = await Order.findById(orderId).populate('products.productId'); // Populate product details

    if (!order) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Order not found' });
    }

    // Check if the order status is payment_failed
    if (order.status === 'payment_failed') {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Cannot change status of an order with payment_failed status',
      });
    }

    // If the order is being cancelled, update the stock
    if (status === 'cancelled' && order.status !== 'cancelled') {
      for (const item of order.products) {
        const product = await Product.findById(item.productId);

        if (product) {
          const sizeIndex = product.sizes.findIndex(
            (size) => size.size.toString() === item.size.toString()
          );
          if (sizeIndex !== -1) {
            product.sizes[sizeIndex].stock += item.quantity; // Rebuild stock
          } else {
            return res
              .status(httpStatusCodes.BAD_REQUEST)
              .json({ success: false, message: `Size ${item.size} not found for product` });
          }
          await product.save();
        }
      }
    }

    // Update the order status
    order.status = status;

    // If the order status is now 'delivered', push userId to the product's purchasedByUserIds field
    if (status === 'delivered') {
      const userId = order.userId;
      for (const item of order.products) {
        const product = await Product.findById(item.productId);
        if (product) {
          // Add userId to the purchasedByUserIds array if not already present
          if (!product.purchasedByUserIds.includes(userId)) {
            product.purchasedByUserIds.push(userId);
            await product.save();
          }
        }
      }
    }

    await order.save();

    if (order.status === 'returned') {
      const userId = order.userId;
      for (const item of order.products) {
        const product = await Product.findById(item.productId);
        if (product) {
          const sizeIndex = product.sizes.findIndex(
            (size) => size.size.toString() === item.size.toString()
          );
          if (sizeIndex !== -1) {
            product.sizes[sizeIndex].stock += item.quantity; // Rebuild stock
          } else {
            return res
              .status(httpStatusCodes.BAD_REQUEST)
              .json({ success: false, message: `Size ${item.size} not found for product` });
          }
          await product.save();
        }
      }
    }

    // Create a transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail', // Use your email service
      auth: {
        user: 'lijons13@gmail.com', // Your email
        pass: process.env.nodemailerPass, // Your email password or an app-specific password
      },
    });

    // Send mail function
    const sendEmail = async (to, subject, text) => {
      const mailOptions = {
        from: 'lijons13@gmail.com', // Sender address
        to: to, // List of recipients
        subject: subject, // Subject line
        text: text, // Plain text body
      };

      try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.response);
      } catch (error) {
        console.error('Error sending email:', error);
      }
    };

    if (order.status === 'returned') {
      const userId = order.userId;
      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(httpStatusCodes.NOT_FOUND)
          .json({ success: false, message: 'User not found' });
      }
      const email = user.email;
      const subject =
        'Your order returned successfully and payment credit to your wallet in future days';
      sendEmail(email, 'Order returned Successfully', subject);
    }
    if (order.status === 'rejected_return') {
      const userId = order.userId;
      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(httpStatusCodes.NOT_FOUND)
          .json({ success: false, message: 'User not found' });
      }
      const email = user.email;
      const subject = 'Your order return application rejected because irrelent reason ';
      sendEmail(email, 'Order returned Failed', subject);
    }
    if (order.status === 'refunded') {
      const userId = order.userId;
      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(httpStatusCodes.NOT_FOUND)
          .json({ success: false, message: 'User not found' });
      }

      let walletId = user.walletId;
      let wallet;
      const refundAmount = order.totalPrice;

      if (walletId) {
        wallet = await Wallet.findById(walletId);
      }

      if (!wallet) {
        wallet = new Wallet({
          userId: userId,
          balance: 0,
        });
        await wallet.save();
        user.walletId = wallet._id;
        await user.save();
      }

      // Update the wallet balance
      wallet.balance += refundAmount;

      // Add a transaction entry
      wallet.transactions.push({
        amount: refundAmount,
        type: 'credit',
        description: `Refund for Order #${order._id}`,
        date: new Date(),
      });

      await wallet.save();

      // Send an email notification
      const email = user.email;
      await sendEmail(
        email,
        'Amount Refunded Successfully',
        `The refunded amount of $${refundAmount} has been credited to your wallet. Enjoy!`
      );

      // return res.status(200).json({ success: true, message: 'Refund processed successfully' });
    }

    res.status(httpStatusCodes.OK).redirect(`/admin/orders/${orderId}`); // Redirect back to orders page
  } catch (error) {
    console.error('Error updating order:', error); // Log the error for debugging
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

const getOrderDetailedPage = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId).populate('products.productId');
    console.log(order, orderId);
    if (!order) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Order not found' });
    }

    res.render('adminorders/orderDetailedPage', { order: order, currentPath: '/order' });
  } catch (error) {
    console.log('error order detailed page', error.message);
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
module.exports = {
  getOrderDetailedPage,
  postEditOrder,
  getOrders,
  getEditOrder,
};
