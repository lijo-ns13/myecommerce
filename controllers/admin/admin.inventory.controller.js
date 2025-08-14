const Product = require('../../models/productSchema');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const getInventory = async (_req, res) => {
  try {
    // Fetch all products
    const products = await Product.find({}, 'product sizes'); // Only fetch product name and sizes

    // Render the admin inventory page with the product data
    res.render('admininventory/inventory', { products, currentPath: '/inventory' });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).send('Error fetching inventory');
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
        .json({ success: false, message: 'Product not found' });
    }

    // Find the size object
    const sizeObj = product.sizes.find((s) => s.size === Number(size));
    if (!sizeObj) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Size not found' });
    }

    // Update stock
    sizeObj.stock += Number(changeInStock); // Increase or decrease stock

    // Save changes
    await product.save();

    res.redirect('/admin/inventory'); // Redirect back to inventory page
  } catch (error) {
    console.error('Error updating stock:', error);
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'Failed to update stock', error: error.message });
  }
};
module.exports = {
  getInventory,
  postInventoryUpdate,
};
