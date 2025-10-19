const express = require('express');
const router = express.Router();
const { jwtAuth, userProtected, checkBlockedUser } = require('../../middlewares/auth');
const cartController = require('../../controllers/user/user.cart.controller');
router.use((req, res, next) => {
  console.log(`Cart Route Hit: ${req.method} ${req.originalUrl}`);
  next();
});
router.use(jwtAuth, userProtected, checkBlockedUser);
router.get('/', cartController.getCart);
router.post('/add', cartController.postAddCart);
router.post('/delete/:id', cartController.postDeleteCart);
router.post('/updateQuantity/:productId/:size', cartController.postUpdateQuantity);

module.exports = router;
