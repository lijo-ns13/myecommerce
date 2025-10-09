const Products = require('../../models/productSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const { getProductsWithOffers } = require('../../services/productService');
const messages = require('../../constants/message');
const getLand = async (req, res) => {
  const products = await Products.find({ isListed: true }).limit(6);
  // const products=await Products.find({});
  // res.json(products);
  currentUserId = req.user ? req.user._id : null;
  const categories = await Category.find({});
  // console.log('products',products)
  const cart = await Cart.find({});
  const userWishlist = currentUserId
    ? await User.findById(currentUserId).populate('wishlist')
    : null;
  const wishlist = userWishlist ? userWishlist.wishlist : [];
  res.render('land', { products: products, currentUserId, wishlist, categories });
};

const getProductDetailed = async (req, res) => {
  const productId = req.params.productId;
  const user = req.user && req.user._id ? req.user._id : null;
  const product = await Products.findById(productId)
    .populate({
      path: 'reviews',
      select: 'rating comment date isDeleted',
      populate: {
        path: 'user',
        select: 'name _id ',
      },
    })
    .populate({
      path: 'category',
      select: 'name _id',
    });
  console.log('productreviews', product.reviews);

  let ratings = product.reviews.map((review) => review.rating);
  let totalRatingCount = ratings.length;
  let rating = ratings.reduce((acc, cur) => acc + cur, 0);
  let avgRating = rating / totalRatingCount;
  if (typeof avgRating === 'number' && !isNaN(avgRating)) {
    avgRating = avgRating.toFixed(2);
  } else {
    avgRating = 0;
  }
  const productOne = await Products.findById(productId);
  currentUserId = req.user ? req.user._id : null;

  // console.log('products',products)
  const cart = await Cart.find({});
  const userWishlist = currentUserId
    ? await User.findById(currentUserId).populate('wishlist')
    : null;
  const wishlist = userWishlist ? userWishlist.wishlist : [];

  let check;
  if (product.finalPrice !== product.price) {
    check = true;
  } else {
    check = false;
  }
  const userId = (req.user && req.user._id) || null;

  const checkPurchase =
    userId && product.purchasedByUserIds && product.purchasedByUserIds.includes(userId);
  const categoryId = product.category;

  const relatedProducts = await Products.find({ category: categoryId, isListed: true });
  // let cartLength;
  // if(req.user){
  //     cartLength = cart.length > 0 && cart[0].products ? cart[0].products.length : 0 ;
  // }else{
  //     cartLength=0;
  // }
  // console.log('cartlen',cart[0].products.length)
  // console.log(product)
  // res.json(product)
  if (check) {
    res.render('product-detailed', {
      product: product,
      relatedProducts: relatedProducts,
      isOffer: true,
      canReview: checkPurchase,
      wishlist,
      productOne,
      user,
      currentUserId,
      avgRating,
    });
  } else {
    res.render('product-detailed', {
      product: product,
      relatedProducts: relatedProducts,
      isOffer: false,
      canReview: checkPurchase,
      wishlist,
      productOne,
      user,
      currentUserId,
      avgRating,
    });
  }
};

const getFullProducts = async (req, res) => {
  const { query = '', category = '', sort = '', page = 1, limit = 18 } = req.query;
  const currentPage = parseInt(page, 10) || 1;
  const pageSize = parseInt(limit, 10) || 18;
  try {
    currentUserId = req.user ? req.user._id : null;
    // Normalize category: always a string or empty
    const selectedCategory = category ? category.toString() : '';
    const cart = await Cart.find({});
    const userWishlist = currentUserId
      ? await User.findById(currentUserId).populate('wishlist')
      : null;
    const wishlist = userWishlist ? userWishlist.wishlist : [];
    // Prepare filter object
    let filter = { isListed: true }; // Only fetch listed products

    // Prepare search filter
    if (query) {
      filter.$or = [
        { product: { $regex: query, $options: 'i' } }, // Case-insensitive search on product name
        { description: { $regex: query, $options: 'i' } }, // Case-insensitive search on description
      ];
    }

    // Filter by category if specified
    if (category) {
      filter.category = category;
    }

    // Define sorting options
    const sortOptionsMap = {
      price_low_high: { finalPrice: 1 },
      price_high_low: { finalPrice: -1 },
      new_arrivals: { createdAt: -1 },
      a_z: { product: 1 },
      z_a: { product: -1 },
    };

    const sortOption = sortOptionsMap[sort] || { createdAt: -1 }; // Default sorting to new arrivals if not specified

    // Fetch categories for dropdown
    const categories = await Category.find();
    const totalProducts = await Product.countDocuments(filter);
    // Fetch products based on filter and sort
    const products = await Product.find(filter)
      .sort(sortOption)
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize);
    const totalPages = Math.ceil(totalProducts / pageSize);
    // Pass data to the view
    res.render('fullproducts', {
      products,
      categories,
      searchQuery: query,
      selectedCategory,
      selectedSort: sort,
      wishlist,
      currentPage,
      totalPages,
      pageSize,
    });
  } catch (error) {
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).send(messages.ERROR.SERVER_ERROR);
  }
};
const getOffer = async (_req, res) => {
  const productsWithOffers = await getProductsWithOffers();
  res.json(productsWithOffers);
};

module.exports = {
  getLand,
  getProductDetailed,
  getFullProducts,
  getOffer,
};
