const User = require('../../models/userSchema');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const Product = require('../../models/productSchema'); // Assuming you have a Product model

const getWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate('wishlist');
    console.log('users', user);
    if (!user.wishlist || user.wishlist.length === 0) {
      console.log('user wishlist empty');
      return res.render('wishlist', { products: [], message: 'Your wishlist is empty.' });
    }

    const wishlistProducts = await Product.find({ _id: { $in: user.wishlist } });

    const productsWithWishlistFlag = wishlistProducts.map((product) => ({
      ...product.toObject(),
      inWishlist: true, // All products here are in the wishlist
    }));
    console.log('produclkja;sdf', productsWithWishlistFlag);

    res.render('wishlist', { products: productsWithWishlistFlag });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'Error fetching wishlist.' });
  }
};
const postWishlistAdd = async (req, res) => {
  try {
    const productId = req.params.productId;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (user.wishlist.includes(productId)) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ message: 'Product already in wishlist' });
    }
    if (!user.wishlist.includes(productId)) {
      user.wishlist.push(productId);
      await user.save();
    }

    return res.json({ success: true, message: 'Added to wishlist!' });
  } catch (error) {
    console.error(error);
    return res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'Error adding to wishlist.' });
  }
};
const postRemoveWishlist = async (req, res) => {
  try {
    const productId = req.params.productId;
    const userId = req.user._id;

    const user = await User.findById(userId);
    user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
    await user.save();

    return res.json({ success: true, message: 'Removed from wishlist!' });
  } catch (error) {
    console.error(error);
    return res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'Error removing from wishlist.' });
  }
};

module.exports = {
  getWishlist,
  postWishlistAdd,
  postRemoveWishlist,
};
