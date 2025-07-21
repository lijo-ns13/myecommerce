const express=require('express');
const path = require('path');
const methodOverride=require('method-override')
const {jwtAuth,adminProtected}=require('../middlewares/auth');
const adminController=require('../controllers/adminController')
const router=express.Router();
router.use(express.urlencoded({ extended: true })); // To parse form data
router.use(methodOverride('_method')); 

router.use(jwtAuth,adminProtected)


router.get('/inventory', adminController.getInventory);

router.post('/inventory/update', adminController.postInventoryUpdate);
router.exports=router;