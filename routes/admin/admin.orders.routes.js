const express = require('express');

const path = require('path');

const methodOverride = require('method-override');
const { jwtAuth, adminProtected } = require('../../middlewares/auth');
const adminController = require('../../controllers/admin/admin.orders.controller');

const router = express.Router();

router.use(express.urlencoded({ extended: true })); // To parse form data
router.use(methodOverride('_method'));

router.use(jwtAuth, adminProtected);

router.get('/', adminController.getOrders);

router.get('/:orderId/edit', adminController.getEditOrder);
router.post('/:orderId/edit', adminController.postEditOrder);
router.get('/:orderId', adminController.getOrderDetailedPage);
module.exports = router;
