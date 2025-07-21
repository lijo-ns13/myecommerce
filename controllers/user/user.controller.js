const express = require('express');
const userModel = require('../../models/userSchema');
const Products = require('../../models/productSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema');

const { getProductsWithOffers } = require('../services/productService');

const getLand = async (req, res) => {
  const products = await Products.find({ isListed: true }).limit(6);
  // const products=await Products.find({});
  // res.json(products);
  console.log('rq.user', req.user);
  currentUserId = req.user ? req.user._id : null;
  console.log('req.user._id', currentUserId);
  const categories = await Category.find({});
  // console.log('products',products)
  const cart = await Cart.find({});
  console.log('cart', cart);
  const userWishlist = currentUserId
    ? await User.findById(currentUserId).populate('wishlist')
    : null;
  const wishlist = userWishlist ? userWishlist.wishlist : [];
  console.log('wishlist/land', wishlist);
  res.render('land', { products: products, currentUserId, wishlist, categories });
};

const getProductDetailed = async (req, res) => {
  const productId = req.params.productId;
  const user = req.user && req.user._id ? req.user._id : null;
  console.log('req.userssssssssssssss', req.user);
  console.log('userIddddddddddddddddd', user);
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
  console.log('avgRating', avgRating);
  console.log('ratinnnnnnnnnnnnnngafasfasfd', ratings);
  const productOne = await Products.findById(productId);
  console.log('rq.user', req.user);
  currentUserId = req.user ? req.user._id : null;
  console.log('currentUserId', currentUserId);

  // console.log('products',products)
  const cart = await Cart.find({});
  console.log('cart', cart);
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
  console.log('checkpurchase', checkPurchase);
  console.log('userid', userId);
  console.log('purchasedByUserIds', product.purchasedByUserIds);
  const categoryId = product.category;
  console.log(categoryId);

  const relatedProducts = await Products.find({ category: categoryId, isListed: true });
  console.log(relatedProducts);

  console.log('cart', cart);
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
  const { query = '', category = '', sort = '' } = req.query;

  try {
    console.log('rq.user', req.user);
    currentUserId = req.user ? req.user._id : null;
    console.log('req.user._id', currentUserId);
    const cart = await Cart.find({});
    console.log('cart', cart);
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

    // Fetch products based on filter and sort
    const products = await Product.find(filter).sort(sortOption);

    // Pass data to the view
    res.render('fullproducts', {
      products,
      categories,
      searchQuery: query,
      selectedCategory: category,
      selectedSort: sort,
      wishlist,
    });
  } catch (error) {
    console.error('Error fetching products or categories:', error);
    res.status(500).send('Internal Server Error');
  }
};
const getOffer = async (req, res) => {
  const productsWithOffers = await getProductsWithOffers();
  res.json(productsWithOffers);
};

module.exports = {
  getLand,
  getProductDetailed,
  getFullProducts,
  getOffer,
};
