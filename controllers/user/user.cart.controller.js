const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const messages = require('../../constants/message');

const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user._id }).populate('products.productId');
    let cartOne = await Cart.find({});
    console.log('cart', cartOne);
    const cartLength = cartOne.length > 0 && cartOne[0].products ? cartOne[0].products.length : 0;
    if (!cart) {
      cart = { products: [] };
    }
    console.log('cart', cart);

    res.render('cart/cart', { cart, cartLength: cartLength });
  } catch (error) {
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).send({ message: error.message });
  }
};

const postAddCart = async (req, res) => {
  try {
    const { productId, size } = req.body;
    const maxQuantity = 5;
    console.log('productId', productId, 'size', size);
    if (!req.user || req.user.role !== 'user') {
      return res
        .status(httpStatusCodes.UNAUTHORIZED)
        .json({ success: false, message: messages.COMMON.UNAUTHORIZED });
    }
    if (!productId || !size) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.CART.PRODUCT_ID_SIZE_REQUIRED });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.COMMON.PRODUCT_NOT_FOUND });
    }

    const sizeDetails = product.sizes.find((s) => s.size === parseInt(size));
    if (!sizeDetails) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.COMMON.SIZE_NOT_FOUND });
    }

    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      cart = new Cart({ userId: req.user._id, products: [] });
    }

    const existingItem = cart.products.find(
      (pro) => pro.productId.toString() === productId && pro.size.toString() === size.toString()
    );

    if (existingItem) {
      if (existingItem.quantity >= maxQuantity) {
        return res
          .status(httpStatusCodes.FORBIDDEN)
          .json({ success: false, message: messages.CART.QUANTITY_MAX_LIMIT });
      }
      if (existingItem.quantity + 1 > sizeDetails.stock) {
        return res
          .status(httpStatusCodes.FORBIDDEN)
          .json({ success: false, message: messages.CART.QUANTITY_STOCK_LIMIT });
      }
      existingItem.quantity += 1;
    } else {
      if (sizeDetails.stock <= 0) {
        return res
          .status(httpStatusCodes.FORBIDDEN)
          .json({ success: false, message: messages.CART.STOCK_UNAVAILABLE });
      }
      cart.products.push({ productId: productId, size: size, quantity: 1 });
    }

    await cart.save();
    res.status(httpStatusCodes.OK).json({ success: true, message: messages.CART.PRODUCT_ADDED });
  } catch (error) {
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: messages.ERROR.SERVER_ERROR });
  }
};

const postDeleteCart = async (req, res) => {
  try {
    const productSize = req.body.size;
    const productId = req.params.id;
    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.COMMON.CART_NOT_FOUND });
    }
    console.log(productSize, 'productsize');
    const productIndex = cart.products.findIndex(
      (p) => p.productId.toString() === productId && p.size.toString() === productSize.toString()
    );
    console.log(productIndex);

    if (productIndex === -1) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.CART.PRODUCT_NOT_IN_CART });
    }

    cart.products.splice(productIndex, 1);
    await cart.save();

    // Populate cart for response
    const updatedCart = await Cart.findOne({ userId: req.user._id }).populate('products.productId');
    res
      .status(httpStatusCodes.OK)
      .json({ success: true, message: messages.CART.PRODUCT_REMOVED, cart: updatedCart });
  } catch (error) {
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: messages.ERROR.SERVER_ERROR, error });
  }
};

const postUpdateQuantity = async (req, res) => {
  try {
    const action = req.body.action;
    const { productId, size } = req.params;
    const maxQuantity = 5;

    const cart = await Cart.findOne({ userId: req.user._id, status: 'active' });
    if (!cart) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.COMMON.CART_NOT_FOUND });
    }

    const product = cart.products.find(
      (p) => p.productId.toString() === productId && p.size.toString() === size.toString()
    );
    if (!product) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.CART.PRODUCT_NOT_IN_CART });
    }

    const productDetails = await Product.findById(productId);
    if (!productDetails) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.COMMON.PRODUCT_NOT_FOUND });
    }

    const sizeDetails = productDetails.sizes.find((s) => s.size === parseInt(size));
    if (!sizeDetails) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.COMMON.SIZE_NOT_FOUND });
    }

    if (action === 'increase') {
      if (product.quantity >= maxQuantity) {
        return res.status(httpStatusCodes.BAD_REQUEST).json({
          success: false,
          message: `Cannot add more than ${maxQuantity} units of this product`,
        });
      }
      if (product.quantity + 1 > sizeDetails.stock) {
        return res
          .status(httpStatusCodes.BAD_REQUEST)
          .json({ success: false, message: messages.CART.QUANTITY_STOCK_LIMIT });
      }
      product.quantity += 1;
    } else if (action === 'decrease') {
      if (product.quantity <= 1) {
        return res
          .status(httpStatusCodes.BAD_REQUEST)
          .json({ success: false, message: messages.CART.QUANTITY_MIN_LIMIT });
      }
      product.quantity -= 1;
    } else {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.CART.INVALID_ACTION });
    }

    await cart.save();
    const updatedCart = await Cart.findOne({ userId: req.user._id }).populate('products.productId');
    res
      .status(httpStatusCodes.OK)
      .json({ success: true, message: messages.CART.QUANTITY_UPDATED, cart: updatedCart });
  } catch (error) {
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: messages.ERROR.SERVER_ERROR });
  }
};

module.exports = {
  getCart,
  postAddCart,
  postDeleteCart,
  postUpdateQuantity,
};
