const Product = require('../../models/productSchema');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const messages = require('../../constants/message');
const getInventory = async (_req, res) => {
  try {
    // Fetch all products
    const products = await Product.find({}, 'product sizes'); // Only fetch product name and sizes

    // Render the admin inventory page with the product data
    res.render('admininventory/inventory', {
      products,
      currentPath: '/inventory',
      layout: 'layouts/adminLayout',
    });
  } catch (error) {
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).send(messages.INVENTORY.FETCH_ERROR);
  }
};
const postInventoryUpdate = async (req, res) => {
  try {
    const { productId, size, changeInStock } = req.body;

    // Find the product
    const product = await Product.findOne({ _id: productId });
    if (!product) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.INVENTORY.PRODUCT_NOT_FOUND });
    }

    // Find the size object
    const sizeObj = product.sizes.find((s) => s.size === Number(size));
    if (!sizeObj) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.INVENTORY.SIZE_NOT_FOUND });
    }

    // Update stock
    sizeObj.stock += Number(changeInStock); // Increase or decrease stock

    // Save changes
    await product.save();

    res.redirect('/admin/inventory'); // Redirect back to inventory page
  } catch (error) {
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: messages.INVENTORY.UPDATE_ERROR, error: error.message });
  }
};
module.exports = {
  getInventory,
  postInventoryUpdate,
};
