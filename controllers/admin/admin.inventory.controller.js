const Product = require('../../models/productSchema');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const messages = require('../../constants/message');
const getInventory = async (req, res) => {
  try {
    // Get page and limit from query parameters with defaults
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Get total count of products for pagination info
    const totalProducts = await Product.countDocuments();

    // Fetch products with pagination
    const products = await Product.find({}, 'product sizes').skip(skip).limit(limit);

    // Calculate total pages
    const totalPages = Math.ceil(totalProducts / limit);

    // Render the inventory page with pagination data
    res.render('admininventory/inventory', {
      products,
      currentPath: '/inventory',
      layout: 'layouts/adminLayout',
      pagination: {
        totalProducts,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
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
