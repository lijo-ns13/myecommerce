const express = require('express');
const router = express.Router();

const adminBannerRouter = require('./admin.banners.routes');
const adminCategoryRouter = require('./admin.category.routes');
const admincouponRouter = require('./admin.coupon.routes');
const adminCustomerRouter = require('./admin.customers.routes');
const adminDashboardRouter = require('./admin.dashboard.routes');
const adminInventoryRouter = require('./admin.invetentory.routes');
const adminOffersRouter = require('./admin.offers.routes');
const adminOrdersRouter = require('./admin.orders.routes');
const adminProductRouter = require('./admin.product.routes');

router.use('/banners', adminBannerRouter);
router.use('/category', adminCategoryRouter);
router.use('/coupon', admincouponRouter);
router.use('/customers', adminCustomerRouter);
router.use('/', adminDashboardRouter);
router.use('/inventory', adminInventoryRouter);
router.use('/offers', adminOffersRouter);
router.use('/orders', adminOrdersRouter);
router.use('/products', adminProductRouter);
