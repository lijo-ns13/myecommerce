const express = require('express');
const cookieParser = require('cookie-parser');
const { jwtAuth, checkBlockedUser } = require('../../middlewares/auth');

const router = express.Router();
router.use(cookieParser());

const userController = require('../../controllers/user/user.controller');

router.use(jwtAuth);

router.get('/', userController.getLand);
router.get('/product-detail/:productId', userController.getProductDetailed);
router.get('/products', userController.getFullProducts);
router.get('/offerproducts', userController.getOffer);

module.exports = router;
