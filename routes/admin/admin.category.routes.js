const express=require('express');
const path = require('path');
const methodOverride=require('method-override')
const {jwtAuth,adminProtected}=require('../middlewares/auth');
const adminController=require('../controllers/adminController')
const router=express.Router();
router.use(express.urlencoded({ extended: true })); // To parse form data
router.use(methodOverride('_method')); 
router.use(jwtAuth,adminProtected)
router.get('/category',adminController.getCategory)
router.get('/category/update/:id',adminController.getCategoryUpdate)

router.patch('/category/update/:id',adminController.patchCategoryUpdate)
// router.delete('/category/delete/:id',adminController.deleteCategoryDelete)
router.get('/category/add-category',adminController.getAddCategory)
router.post('/category/add-category',adminController.postAddCategory)

router.post('/category/block/:id',adminController.postCategoryBlock)
router.post('/category/unblock/:id',adminController.postCategoryUnblock)

module.exports=router;