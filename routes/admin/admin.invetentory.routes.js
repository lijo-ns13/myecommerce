const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const { jwtAuth, adminProtected } = require('../../middlewares/auth');
const adminController = require('../../controllers/admin/admin.inventory.controller');
const router = express.Router();
router.use(express.urlencoded({ extended: true })); // To parse form data
router.use(methodOverride('_method'));

router.use(jwtAuth, adminProtected);

router.get('/', adminController.getInventory);

router.post('/update', adminController.postInventoryUpdate);
router.exports = router;
