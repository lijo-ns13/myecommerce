const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const { jwtAuth, adminProtected } = require('../../middlewares/auth');
const adminController = require('../../controllers/admin/admin.category.controller');
const router = express.Router();
router.use(express.urlencoded({ extended: true })); // To parse form data
router.use(methodOverride('_method'));
router.use(jwtAuth, adminProtected);
router.get('/', adminController.getCategory);
router.get('/update/:id', adminController.getCategoryUpdate);

router.patch('/update/:id', adminController.patchCategoryUpdate);
// router.delete('/category/delete/:id',adminController.deleteCategoryDelete)
router.get('/add-category', adminController.getAddCategory);
router.post('/add-category', adminController.postAddCategory);

router.post('/block/:id', adminController.postCategoryBlock);
router.post('/unblock/:id', adminController.postCategoryUnblock);

module.exports = router;
