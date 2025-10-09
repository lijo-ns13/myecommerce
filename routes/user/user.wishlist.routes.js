const express = require('express');
const router = express.Router();
const { jwtAuth, userProtected, checkBlockedUser } = require('../../middlewares/auth');
const wishlistController = require('../../controllers/user/user.wishlist.controller');

router.use(jwtAuth, userProtected, checkBlockedUser);

router.get('/', wishlistController.getWishlist);
router.post('/add/:productId', wishlistController.postWishlistAdd);
router.post('/remove/:productId', wishlistController.postRemoveWishlist);
module.exports = router;
