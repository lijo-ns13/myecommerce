const express=require('express');

const path = require('path');

const methodOverride=require('method-override')
const {jwtAuth,adminProtected}=require('../middlewares/auth');
const adminController=require('../controllers/adminController')

const router=express.Router();

router.use(express.urlencoded({ extended: true })); // To parse form data
router.use(methodOverride('_method')); 



router.use(jwtAuth,adminProtected)




router.get('/orders', adminController.getOrders);

router.get('/orders/:orderId/edit', adminController.getEditOrder);
router.post('/orders/:orderId/edit', adminController.postEditOrder);
router.get('/orders/:orderId',adminController.getOrderDetailedPage);
module.exports=router;