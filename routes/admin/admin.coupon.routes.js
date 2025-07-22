const express = require('express');
const methodOverride = require('method-override');
const { jwtAuth, adminProtected } = require('../../middlewares/auth');
const couponController = require('../../controllers/admin/admin.coupon.controller');
const router = express.Router();
router.use(express.urlencoded({ extended: true })); // To parse form data
router.use(methodOverride('_method'));

router.use(jwtAuth, adminProtected);

router.get('/coupons', couponController.getCoupons);
router.get('/edit/:id', couponController.getEditCoupon);
router.patch('/edit/:id', couponController.editCoupon);
router.get('/add-coupon', couponController.getAddCoupon);
router.post('/add-coupon', couponController.addCoupon);
router.delete('/coupon/delete/:id', couponController.deleteCoupon);

module.exports = router;
