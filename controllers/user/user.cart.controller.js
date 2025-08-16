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
    const maxQuantity = 5; // Maximum quantity allowed per product
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

    // Find the size details for the product
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
      // Check if the existing item’s quantity is less than the max allowed
      if (existingItem.quantity >= maxQuantity) {
        return res
          .status(httpStatusCodes.FORBIDDEN)
          .json({ success: false, message: messages.CART.QUANTITY_MAX_LIMIT });
      }
      // Check if adding one more exceeds the available stock
      if (existingItem.quantity + 1 > sizeDetails.stock) {
        return res
          .status(httpStatusCodes.FORBIDDEN)
          .json({ success: false, message: messages.CART.QUANTITY_STOCK_LIMIT });
      }
      existingItem.quantity += 1; // Increment quantity by 1
    } else {
      // Check if the stock is sufficient for adding 1 product
      if (sizeDetails.stock <= 0) {
        return res
          .status(httpStatusCodes.FORBIDDEN)
          .json({ success: false, message: messages.CART.STOCK_UNAVAILABLE });
      }
      // Add the new item with quantity of 1
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
        .send({ message: messages.COMMON.CART_NOT_FOUND });
    }
    console.log(productSize, 'productsize');
    const productIndex = cart.products.findIndex(
      (p) => p.productId.toString() === productId && p.size.toString() === productSize.toString()
    );
    console.log(productIndex);

    // Correct the condition to check for `-1` when the product is not found
    if (productIndex === -1) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .send({ message: messages.CART.PRODUCT_NOT_IN_CART });
    }

    cart.products.splice(productIndex, 1);
    await cart.save();

    // Redirect to the cart page after successful deletion
    res.status(httpStatusCodes.OK).redirect('/cart');
  } catch (error) {
    // Handle error properly
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .send({ message: messages.ERROR.SERVER_ERROR, error });
  }
};

const postUpdateQuantity = async (req, res) => {
  try {
    const action = req.body.action; // 'increase' or 'decrease'
    const { productId, size } = req.params; // Extract from URL params
    const maxQuantity = 5; // Maximum quantity allowed for a single product

    // Find the active cart for the user
    const cart = await Cart.findOne({ userId: req.user._id, status: 'active' });
    if (!cart) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.COMMON.CART_NOT_FOUND });
    }

    // Find the product in the cart
    const product = cart.products.find(
      (p) => p.productId.toString() === productId && p.size.toString() === size.toString()
    );
    if (!product) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.CART.PRODUCT_NOT_IN_CART });
    }

    // Find the product details
    const productDetails = await Product.findById(productId);
    if (!productDetails) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.COMMON.PRODUCT_NOT_FOUND });
    }

    // Find the size details for the product
    const sizeDetails = productDetails.sizes.find((s) => s.size === parseInt(size));
    if (!sizeDetails) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.COMMON.SIZE_NOT_FOUND });
    }

    // Check stock availability and enforce quantity limits
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
          .json({ success: false, message: messages.CART.QUANTITY_STOCK_LIMI });
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

    // Save the updated cart
    await cart.save();
    res.status(httpStatusCodes.OK).json({ success: true, message: messages.CART.QUANTITY_UPDATED });
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
