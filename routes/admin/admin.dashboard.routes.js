const express = require('express');
const methodOverride = require('method-override');
const { jwtAuth, adminProtected } = require('../../middlewares/auth');
const router = express.Router();
const adminDashboardController = require('../../controllers/admin/admin.dashboard.controller');
router.use(express.urlencoded({ extended: true }));
router.use(methodOverride('_method'));
router.use(jwtAuth, adminProtected);

router.get('/sales/graph', adminDashboardController.getSalesGraph);
router.get('/orders/counts', adminDashboardController.getOrdersCount);
router.get('/orders/stats', adminDashboardController.getOrdersStats);
// router.get('/dashboard',adminController.getDashboard)
router.get('/dashboard', adminDashboardController.getDashboard);
router.get('/sales/report', adminDashboardController.getSalesGraph);
router.get('/sales/report/pdf', adminDashboardController.getSalesReportPDF);

module.exports = router;
