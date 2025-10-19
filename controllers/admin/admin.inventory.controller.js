const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Review = require('../../models/reviewSchema'); // Assume this exists with 'rating' field
const httpStatusCodes = require('../../constants/httpStatusCodes');
const messages = require('../../constants/message');

const getInventory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5; // Set to 5 per page
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = search
      ? {
          $or: [
            { product: { $regex: search, $options: 'i' } },
            { brand: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const [totalProducts, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query).populate('category').skip(skip).limit(limit),
    ]);

    const totalPages = Math.ceil(totalProducts / limit);

    // Calculate average rating for each product (industry-level enhancement)
    for (let product of products) {
      const reviews = await Review.find({ _id: { $in: product.reviews } });
      product.averageRating =
        reviews.length > 0
          ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
          : 'N/A';
    }

    res.render('admininventory/inventory', {
      products,
      currentPath: '/inventory',
      layout: 'layouts/adminLayout',
      currentPage: page,
      totalPages,
      search,
      limit,
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: messages.INVENTORY.FETCH_ERROR,
    });
  }
};

const getInventoryData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5; // Set to 5 per page
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = search
      ? {
          $or: [
            { product: { $regex: search, $options: 'i' } },
            { brand: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const [totalProducts, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query).populate('category').skip(skip).limit(limit),
    ]);

    const totalPages = Math.ceil(totalProducts / limit);

    // Calculate average rating for each product
    for (let product of products) {
      const reviews = await Review.find({ _id: { $in: product.reviews } });
      product.averageRating =
        reviews.length > 0
          ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
          : 'N/A';
    }

    res.json({
      products: products.map((p) => p.toObject()),
      currentPage: page,
      totalPages,
      search,
      limit,
    });
  } catch (error) {
    console.error('Error fetching inventory data:', error);
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: messages.INVENTORY.FETCH_ERROR,
    });
  }
};

const postInventoryUpdate = async (req, res) => {
  try {
    const { productId, size, changeInStock } = req.body;
    const change = Number(changeInStock);

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.INVENTORY.PRODUCT_NOT_FOUND });
    }

    const sizeObj = product.sizes.find((s) => s.size === Number(size));
    if (!sizeObj) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.INVENTORY.SIZE_NOT_FOUND });
    }

    // Prevent negative stock (industry-level validation)
    if (sizeObj.stock + change < 0) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.INVENTORY.NEGATIVE_STOCK_ERROR });
    }

    // Update stock
    sizeObj.stock += change;

    await product.save();

    res.status(httpStatusCodes.OK).json({
      success: true,
      message: messages.INVENTORY.UPDATE_SUCCESS,
      updatedStock: sizeObj.stock,
    });
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: messages.INVENTORY.UPDATE_ERROR,
    });
  }
};

module.exports = {
  getInventory,
  getInventoryData,
  postInventoryUpdate,
};
