const express = require('express');
const methodOverride = require('method-override');
const { jwtAuth, adminProtected } = require('../../middlewares/auth');
const adminController = require('../../controllers/admin/admin.customer.controller');

const router = express.Router();

router.use(express.urlencoded({ extended: true })); // To parse form data
router.use(methodOverride('_method'));

router.use(jwtAuth, adminProtected);

router.get('/', adminController.getCustomers);
router.post('/block-user/:id', adminController.postCustomerBlock);
router.post('/unblock-user/:id', adminController.postCustomerUnblock);

module.exports = router;
