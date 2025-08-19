const express = require('express');
const methodOverride = require('method-override');
const { jwtAuth, adminProtected } = require('../../middlewares/auth');
const adminController = require('../../controllers/admin/admin.inventory.controller');
const router = express.Router();
router.use(express.urlencoded({ extended: true }));
router.use(methodOverride('_method'));

router.use(jwtAuth, adminProtected);

router.get('/', adminController.getInventory);
router.post('/update', adminController.postInventoryUpdate);

module.exports = router;
