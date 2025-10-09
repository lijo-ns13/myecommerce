const express = require('express');
const router = express.Router();

const { jwtAuth, userProtected, checkBlockedUser } = require('../../middlewares/auth');
const reviewController = require('../../controllers/user/user.review.controller');

router.use(jwtAuth, userProtected, checkBlockedUser);

router.get('/add/:productId', reviewController.getAddReview);
router.post('/add/:productId', reviewController.addReview);
router.get('/edit/:reviewId', reviewController.getEditReview);
router.post('/edit/:reviewId', reviewController.editReview);
router.delete('/delete/:reviewId', reviewController.deleteReview);

module.exports = router;
