// checkoutController.js
const express = require('express');
const Razorpay = require('razorpay');
const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const Coupon = require('../../models/couponSchema');
const Category = require('../../models/categorySchema');
const Wallet = require('../../models/walletSchema');
const crypto = require('crypto');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const { CART } = require('../../constants/message');
const mongoose = require('mongoose');

const getCheckout = async (req, res) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ userId }).populate('products.productId');
    if (!cart || cart.products.length === 0) {
      return res.redirect('/cart');
    }

    const user = await User.findById(userId).populate('address');
    if (!user) {
      return res.redirect('/auth/signin');
    }

    let totalPrice = 0;
    cart.products.forEach((item) => {
      totalPrice += item.productId.finalPrice * item.quantity;
    });

    res.render('checkout', {
      cart,
      user,
      totalPrice,
    });
  } catch (error) {
    console.error('Error fetching checkout data:', error);
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .send('Something went wrong. Please try again later.');
  }
};

const postCheckout = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const { paymentMethod, selectedAddress, addressDetails } = req.body;

    if (!paymentMethod) {
      throw new Error('Payment method is required');
    }

    const cart = await Cart.findOne({ userId }).populate('products.productId').session(session);
    if (!cart || cart.products.length === 0) {
      throw new Error('Your cart is empty');
    }

    const orderedProducts = [];
    let originalPrice = 0;
    let subtotalAfterOffers = 0;
    let offerTotalDiscount = 0;

    for (const product of cart.products) {
      const { productId, size, quantity } = product;
      const productDetails = await Product.findById(productId).session(session);

      if (!productDetails) {
        throw new Error(`Product not found for ID: ${productId}`);
      }

      const category = await Category.findById(productDetails.category).session(session);
      if (category.isBlocked) {
        throw new Error('Category is blocked');
      }

      const offerDiscountPerUnit = productDetails.price - productDetails.finalPrice;
      const finalUnitPrice = productDetails.finalPrice;

      originalPrice += productDetails.price * quantity;
      subtotalAfterOffers += finalUnitPrice * quantity;
      offerTotalDiscount += offerDiscountPerUnit * quantity;

      orderedProducts.push({
        productName: productDetails.product,
        productPrice: productDetails.price,
        productQuantity: quantity,
        productSize: size,
        productId: productDetails._id.toString(),
        productImage: productDetails.images[0].secured_url,
        offerDiscountPerUnit,
        finalUnitPrice,
      });
    }

    let couponDiscount = 0;
    let couponId = null;
    let totalPriceAfterCoupon = subtotalAfterOffers;

    if (req.session.couponCode) {
      const coupon = await Coupon.findOne({ couponCode: req.session.couponCode }).session(session);
      if (coupon) {
        couponDiscount = subtotalAfterOffers - cart.finalPrice;
        totalPriceAfterCoupon = cart.finalPrice;
        couponId = coupon._id;
      }
    }

    const discount = offerTotalDiscount + couponDiscount;

    let address;
    if (selectedAddress === 'new') {
      address = new Address({
        user: userId,
        ...addressDetails,
      });
      await address.save({ session });
      await User.findByIdAndUpdate(userId, { $push: { addresses: address._id } }, { session });
    } else {
      address = await Address.findById(selectedAddress).session(session);
      if (!address) {
        throw new Error('Invalid address selected');
      }
    }

    for (const product of cart.products) {
      const updateResult = await Product.updateOne(
        {
          _id: product.productId,
          'sizes.size': product.size,
          'sizes.stock': { $gte: product.quantity },
        },
        {
          $inc: { 'sizes.$.stock': -product.quantity },
        },
        { session }
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error(
          `Insufficient stock for product ID: ${product.productId} in size ${product.size}`
        );
      }
    }

    for (const product of cart.products) {
      const productDetails = await Product.findById(product.productId).session(session);
      productDetails.orderCount += product.quantity;
      await productDetails.save({ session });

      const category = await Category.findById(productDetails.category).session(session);
      category.orderCount += product.quantity;
      await category.save({ session });
    }

    const calculateDeliveryDate = (daysToAdd) => {
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() + daysToAdd);
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const year = currentDate.getFullYear();
      return `${month}-${day}-${year}`;
    };

    const generatedOrderId = () => {
      const prefix = 'ORD';
      const timestamp = Date.now();
      const randomPart = Math.floor(1000 + Math.random() * 9000);
      return `${prefix}-${timestamp}-${randomPart}`;
    };

    const genOrderId = generatedOrderId();
    const deliveryDate = calculateDeliveryDate(7);

    const orderData = {
      userId,
      products: cart.products,
      totalPrice: totalPriceAfterCoupon,
      shippingAddress: address,
      paymentDetails: {
        paymentMethod,
        transactionId: 'pending',
      },
      originalPrice,
      deliveryDate,
      isDiscount: discount > 0,
      discount,
      orderedProducts,
      status: paymentMethod === 'razorpay' ? 'pending' : 'processing',
      genOrderId,
      couponDiscount,
      couponId,
      offerTotalDiscount,
      subtotalAfterOffers,
    };

    const newOrder = new Order(orderData);
    await newOrder.save({ session });

    const hash = crypto.createHash('sha256').update(newOrder._id.toString()).digest('hex');
    const shortTransactionId = hash.substring(0, 10);
    newOrder.paymentDetails.transactionId = shortTransactionId;
    await newOrder.save({ session });

    if (paymentMethod === 'razorpay') {
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
      const options = {
        amount: totalPriceAfterCoupon * 100,
        currency: 'INR',
        receipt: `receipt_order_${new Date().getTime()}`,
      };

      const razorpayOrder = await razorpay.orders.create(options);
      if (!razorpayOrder) {
        throw new Error('Issue creating Razorpay order');
      }

      newOrder.razorpayOrderId = razorpayOrder.id;
      await newOrder.save({ session });
    } else if (paymentMethod === 'wallet') {
      const userWallet = await Wallet.findOne({ userId }).session(session);
      if (userWallet.balance < totalPriceAfterCoupon) {
        throw new Error('Insufficient wallet balance');
      }
      userWallet.balance -= totalPriceAfterCoupon;
      userWallet.transactions.push({
        amount: totalPriceAfterCoupon,
        type: 'debit',
        description: 'amount debited',
        date: new Date(),
      });
      await userWallet.save({ session });
    }

    await session.commitTransaction();

    req.session.couponCode = null;
    await Cart.deleteOne({ userId });

    if (paymentMethod === 'razorpay') {
      return res.json({
        success: true,
        orderId: newOrder._id,
        razorpayOrderId: newOrder.razorpayOrderId,
        amount: totalPriceAfterCoupon * 100,
      });
    } else {
      return res.status(httpStatusCodes.OK).json({
        success: true,
        orderId: newOrder._id,
        amount: newOrder.totalPrice,
      });
    }
  } catch (error) {
    await session.abortTransaction();
    console.error('Error processing order:', error);
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'Internal Server Error', error: error.message });
  } finally {
    session.endSession();
  }
};

const postCheckCatPro = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user._id });

    const { paymentMethod } = req.body;

    const cart = await Cart.findOne({ userId: req.user._id }).populate('products.productId');
    if (!cart || cart.products.length === 0) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Your cart is empty' });
    }
    if (cart.finalPrice > 5000 && paymentMethod === 'cod') {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message:
          'Amount greater than 5000 not applicable with COD. Please make the payment online.',
      });
    }
    if (wallet && wallet.balance < cart.finalPrice && paymentMethod === 'wallet') {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Your wallet amount low' });
    }
    for (const product of cart.products) {
      const { productId, size, quantity } = product;
      const productDetails = await Product.findOne({ _id: productId, 'sizes.size': size });
      const categoryId = productDetails.category;
      const checkCategory = await Category.findById(categoryId);

      if (checkCategory.isBlocked) {
        return res.status(httpStatusCodes.BAD_REQUEST).json({
          success: false,
          message: `We're sorry, but you can't purchase "${productDetails.product}". This category is currently blocked.`,
        });
      }

      if (!productDetails) {
        return res.status(httpStatusCodes.BAD_REQUEST).json({
          success: false,
          message: `Unfortunately, we couldn't find a product with the ID: ${productId}. Please check and try again.`,
        });
      }
      if (productDetails.isListed == false) {
        return res.status(httpStatusCodes.BAD_REQUEST).json({
          success: false,
          message: `product is temporary blocked ,${productDetails.product}`,
        });
      }

      const sizeDetails = productDetails.sizes.find((s) => s.size === size);
      if (!sizeDetails || sizeDetails.stock < quantity) {
        return res.status(httpStatusCodes.BAD_REQUEST).json({
          success: false,
          message: `Oops! It looks like there isn’t enough stock for "${productDetails.product}" in size "${size}". Available stock: ${sizeDetails ? sizeDetails.stock : 0}. Please adjust your quantity.`,
        });
      }
    }

    res.status(httpStatusCodes.OK).json({ success: true, message: 'All products are available' });
  } catch (error) {
    console.error('Error checking category and product availability:', error);
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'Server error' });
  }
};

const postCouponCheck = async (req, res) => {
  try {
    const { couponCode } = req.body;

    if (!req.user || !req.user._id) {
      return res
        .status(httpStatusCodes.UNAUTHORIZED)
        .json({ success: false, message: 'User not authenticated' });
    }

    const coupon = await Coupon.findOne({ couponCode: couponCode });
    if (!coupon) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Invalid coupon' });
    }

    const currentDate = new Date();
    if (currentDate < coupon.startDate || currentDate > coupon.endDate) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Coupon is expired or not valid yet' });
    }

    if (coupon.usageLimit <= 0) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Coupon usage limit exceeded' });
    }

    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart || cart.products.length === 0) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Cart is empty' });
    }

    let totalPrice = 0;
    for (const product of cart.products) {
      const productDetails = await Product.findById(product.productId);
      if (!productDetails) {
        return res
          .status(httpStatusCodes.BAD_REQUEST)
          .json({ success: false, message: 'Product not found in the cart' });
      }
      totalPrice += productDetails.finalPrice * product.quantity;
    }

    if (totalPrice < coupon.minPurchaseAmount) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Minimum purchase amount for this coupon is ${coupon.minPurchaseAmount}`,
      });
    }
    if (coupon.usedUsers.includes(req.user._id)) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Coupon has already been used by this user' });
    }
    let discount = 0;
    let discountPercentage = 0;

    if (coupon.discountType === 'percentage') {
      discountPercentage = coupon.discountValue;
      discount = (coupon.discountValue / 100) * totalPrice;
    }

    const finalPrice = totalPrice - discount;

    const adjustedFinalPrice = Math.max(finalPrice, 0);
    req.session.couponCode = couponCode;
    cart.finalPrice = adjustedFinalPrice;
    await cart.save();
    req.session.finalPrice = cart.finalPrice;
    if (!coupon.usedUsers.includes(req.user._id)) {
      coupon.usedUsers.push(req.user._id);
      await coupon.save();
    } else {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ message: 'Coupon has already been used by this user' });
    }

    res.status(httpStatusCodes.OK).json({
      success: true,
      message: 'Coupon applied successfully',
      totalPrice: adjustedFinalPrice,
      discount: discount,
      originalPrice: totalPrice,
      discountPercentage: Math.round(discountPercentage * 100) / 100,
    });

    await Coupon.updateOne({ _id: coupon._id }, { $inc: { usageLimit: -1 } });
  } catch (error) {
    console.error('Error applying coupon:', error);
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'Internal Server Error' });
  }
};
const postCouponDelete = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user._id });

    if (cart) {
      cart.finalPrice = cart.finalTotalPrice;
      await cart.save();
      req.session.finalPrice = cart.finalPrice;
      const couponCode = req.session.couponCode;
      const coupon = await Coupon.findOne({ couponCode: couponCode });

      if (coupon) {
        const userIndex = coupon.usedUsers.indexOf(req.user._id);
        if (userIndex > -1) {
          coupon.usedUsers.splice(userIndex, 1);
          await coupon.save();
        } else {
          return res
            .status(httpStatusCodes.BAD_REQUEST)
            .json({ message: 'User ID not found in used users.' });
        }
      } else {
        return res.status(httpStatusCodes.NOT_FOUND).json({ message: 'Coupon not found.' });
      }

      await Coupon.updateOne({ _id: coupon._id }, { $inc: { usageLimit: 1 } });
      res.status(httpStatusCodes.OK).json({ message: 'Coupon deleted and final price updated.' });
    } else {
      res.status(httpStatusCodes.NOT_FOUND).json({ message: 'Cart not found.' });
    }
  } catch (error) {
    console.error(error);
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: 'An error occurred while deleting the coupon.' });
  }
};
const getPaymentFailed = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId).populate('products.productId');
    if (!order) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Order not found' });
    }
    res.status(httpStatusCodes.OK).render('order/payment-fail', { order: order });
  } catch (error) {
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
const getOrderConfirmation = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(httpStatusCodes.NOT_FOUND).send('Order not found');
    }
    req.session.couponCode = null;

    res.render('order/order-confirmation', {
      order,
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .send('Something went wrong. Please try again later.');
  }
};

module.exports = {
  getCheckout,
  postCheckout,
  postCheckCatPro,
  postCouponCheck,
  postCouponDelete,
  getPaymentFailed,
  getOrderConfirmation,
};
