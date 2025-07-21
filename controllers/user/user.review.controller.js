const Review = require('../../models/reviewSchema');
const Product = require('../../models/productSchema');

const getAddReview = async (req, res) => {
  try {
    const userId = req.user._id;
    const productId = req.params.productId;
    const product = await Product.findById(productId);
    if (product.purchasedByUserIds.includes(userId)) {
      // you can add review
      return res.status(200).render('addreview', { isAccess: true, product });
    } else {
      // you cant review this product because you dont purchase this prdouct
      return res.status(200).render('addreview', { isAccess: false, product });
    }
  } catch (error) {
    console.log('error in add review page showing ', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};
const addReview = async (req, res) => {
  try {
    const productId = req.params.productId;
    const userId = req.user._id;
    const { rating, comment } = req.body;

    if (!rating) {
      return res.status(400).json({ success: false, message: 'Rating is required' });
    }
    if (!comment) {
      return res.status(400).json({ success: false, message: 'comment is required' });
    }
    if (comment.length < 10 || comment.length > 500) {
      return res
        .status(400)
        .json({ success: false, message: 'Comment length must be between 10 and 500 characters.' });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Check if user has already reviewed the product
    if (product.reviewAddedUserIds.includes(userId)) {
      return res
        .status(400)
        .json({ success: false, message: 'You have already added a review for this product.' });
    }

    // Create new review
    const newReview = new Review({
      user: userId,
      product: product._id,
      comment: comment,
      rating: rating,
      date: new Date(),
    });

    // Save review and update product
    await newReview.save();
    product.reviewAddedUserIds.push(userId);
    product.reviews.push(newReview._id);
    await product.save();

    return res.status(200).json({ success: true, message: 'Review added successfully.' });
  } catch (error) {
    console.error('Error in add review:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
const getEditReview = async (req, res) => {
  try {
    const reviewId = req.params.reviewId;
    const review = await Review.findById(reviewId).populate('user', 'name');

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    // Render the edit form with the review data
    res.render('editReview', { review });
  } catch (error) {
    console.error('Error fetching review for edit:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
const editReview = async (req, res) => {
  try {
    const userId = req.user._id; // Get the current user's ID
    const reviewId = req.params.reviewId; // Get the review ID from the URL
    const { rating, comment, productId } = req.body; // Destructure the body for easier access

    // Find the review and update it
    const updatedReview = await Review.findByIdAndUpdate(
      reviewId,
      { rating, comment },
      { new: true }
    );

    if (!updatedReview) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    return res.status(200).json({ success: true, message: 'Review updated successfully' });
  } catch (error) {
    console.error('Error updating review:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};
const deleteReview = async (req, res) => {
  try {
    const userId = req.user._id;
    const reviewId = req.params.reviewId;
    const productId = req.body.productId; // Get the productId from the request body

    // Optionally, check if the user is authorized to delete this review

    // Find and delete the review
    const review = await Review.findByIdAndDelete(reviewId);

    // Check if review was found
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Optionally, remove the review from the product's data
    await Product.findByIdAndUpdate(productId, { $pull: { reviews: reviewId } });
    await Product.findByIdAndUpdate(productId, { $pull: { reviewAddedUserIds: userId } });
    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ message: 'Error deleting review' });
  }
};
module.exports = {
  getAddReview,
  addReview,
  getEditReview,
  editReview,
  deleteReview,
};
