const express=require('express');

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const methodOverride=require('method-override')
const Product = require('../models/productSchema'); // Adjust the path to your Product model
const Category=require('../models/categorySchema')
const userModel=require('../models/userSchema')
const Order=require('../models/orderSchema')
const Coupon=require('../models/couponSchema')

const {jwtAuth,adminProtected,userProtected}=require('../middlewares/auth');
const adminController=require('../controllers/adminController')

const router=express.Router();

router.use(express.urlencoded({ extended: true })); // To parse form data
router.use(methodOverride('_method')); 

const uploadsDir = path.join(__dirname, '../uploads');

router.use(jwtAuth,adminProtected)


// router.get('/dashboard',adminController.getDashboard)
router.get('/dashboard',(req,res)=>{
  res.render('dashboard')
})

// admin product section************************************************************************************
router.get('/products',adminController.getProduct)
router.get('/products/viewproducts',adminController.getViewProduct)
router.get('/products/add-product',adminController.getAddProduct)
// Ensure the upload directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

// Function to save base64 image data
const saveBase64Image = async (dataUrl, filename) => {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('Invalid base64 image data');
  }

  const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 image data format');
  }

  const fileExtension = matches[1] || 'jpeg'; // Default to jpeg if unspecified
  const base64Data = matches[2].replace(/\s/g, ''); // Remove whitespace

  const filePath = path.join(uploadsDir, `${filename}.${fileExtension}`);

  try {
    await sharp(Buffer.from(base64Data, 'base64')).toFile(filePath);
  } catch (error) {
    console.error('Error saving image with sharp:', error);
    throw new Error('Failed to save image');
  }

  return filePath;
};
router.post('/products/add-product', upload.array('productImages', 5),adminController.postAddProduct );

// Helper function to generate a unique filename
const generateUniqueFilename = () => {
  return `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
};
router.post('/products/unlist-product/:id',adminController.postUnlist)
router.post('/products/list-product/:id',adminController.postList)

router.get('/products/edit/:id',adminController.getProductEdit)
router.patch('/products/edit/:id', upload.array('newImages', 5), adminController.patchProductEdit);


// admin/products/edit/66d57f2a530693faed1f2e4c/
// router.post('/products/edit/:product-id',(req,res)=>{
//   res.json('success')
// })


// admin customers section


// Get all customers******************************************************************************
router.get('/customers', adminController.getCustomers);
router.post('/customers/block-user/:id',adminController.postCustomerBlock)
router.post('/customers/unblock-user/:id',adminController.postCustomerUnblock)


// CATETGORY**************************************************************************

router.get('/category',adminController.getCategory)
router.get('/category/update/:id',adminController.getCategoryUpdate)

router.patch('/category/update/:id',adminController.patchCategoryUpdate)
router.delete('/category/delete/:id',adminController.deleteCategoryDelete)
router.get('/category/add-category',adminController.getAddCategory)
router.post('/category/add-category',adminController.postAddCategory)

// ORDER ****************************************

router.get('/orders', adminController.getOrders);

router.get('/orders/:orderId/edit', adminController.getEditOrder);
router.post('/orders/:orderId', adminController.postEditOrder);

// Inventory and stock management
router.get('/inventory', adminController.getInventory);

router.post('/inventory/update', adminController.postInventoryUpdate);

// coupon management ******************************************************************
router.get('/coupons',async(req,res)=>{
  try{
    const coupons=await Coupon.find({});
    res.render('admincoupon/coupon',{coupons:coupons})
  }catch(error){
    res.status(400).json({success:false,message:error.message})
  }
})
router.get('/coupon/edit/:id',async(req,res)=>{
  try {
    const couponId=req.params.id;
    const coupon=await Coupon.findById(couponId);
    if(!coupon){
      return res.status(400).json({success:false,message:'Coupon not found'})
    }
    res.render('admincoupon/editcoupon',{coupon:coupon})
  } catch (error) {
    res.status(400).json({success:false,message:error.message})
  }
})
// /admin/coupon/edit/<%=coupon._id%>
router.patch('/coupon/edit/:id',async(req,res)=>{
  try {
    const couponId=req.params.id;
   
    
    const {couponCode,discountType,discountValue,expiryDate,minPurchaseAmount,maxDiscount,usageLimit}=req.body;
    if(!couponCode || !discountType || !discountValue || !expiryDate || !minPurchaseAmount || !maxDiscount || !usageLimit){
      return res.status(400).json({success:false,message:'Please fill all fields'})
    }
    const couponCodeRegex=/^[A-Z0-9]{6,12}(-[A-Z0-9]{6,12})?$/;
    if(!couponCodeRegex.test(couponCode)){
      return res.status(400).json({success:false,message:'Invalid coupon code'})
    }
    const couponone=await Coupon.findOne({couponCode});
    if(couponone){
      return res.status(400).json({success:false,message:'Coupon code already exists'})
    }
    if (isNaN(discountValue) || discountValue < 0) {
      return res.status(400).json({ success: false, message: 'Discount value must be a valid number and cannot be negative' });
    }
    
    if(minPurchaseAmount<400){
      return res.status(400).json({success:false,message:'Minimum purchase amount cannot be less than 400'})
    }
    if(discountType==='percentage' && discountValue>80){
      return res.status(400).json({success:false,message:'discountvalue in percentage in not greterthan 80'})
    }
    // Check for discount type and validate based on it
    if (discountType === 'percentage') {
      if (discountValue <= 0 || discountValue > 80) {
        return res.status(400).json({ success: false, message: 'Percentage discount value should be between 1 and 80' });
      }
      
    } else if (discountType === 'fixed') {
      if (discountValue <= 0 || discountValue > maxDiscount) {
        return res.status(400).json({ success: false, message: 'Fixed discount value cannot exceed max discount' });
      }
    }
    
    // Global max discount check for both types
    if (maxDiscount > 10000) {
      return res.status(400).json({ success: false, message: 'Maximum discount cannot be greater than 10000' });
    }

    
    if(usageLimit<0){
      return res.status(400).json({success:false,message:'the limit should be greter zero'})
    }
    const parsedExpiryDate = new Date(expiryDate);
    if (isNaN(parsedExpiryDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid expiry date format' });
    }
    if (parsedExpiryDate < new Date()) {
      return res.status(400).json({ success: false, message: 'Expiry date must be in the future' });
    }
    const validDiscountTypes = ['percentage', 'fixed'];
    if (!validDiscountTypes.includes(discountType)) {
      return res.status(400).json({ success: false, message: 'Invalid discount type' });
    }
    const coupon=await Coupon.findByIdAndUpdate(couponId,req.body,{new:true});
    res.status(200).json({success:true,message:'Coupon updated successfuly'})
  } catch (error) {
    res.status(400).json({success:false,message:error.message})
  }
})
router.get('/coupon/add-coupon',async(req,res)=>{
  try {
    res.render('admincoupon/addcoupon')
  } catch (error) {
    res.status(400).json({success:false,message:error.message})
  }
})
router.post('/coupon/add-coupon',async(req,res)=>{
  try {
    
    const {couponCode,discountType,discountValue,expiryDate,minPurchaseAmount,maxDiscount,usageLimit}=req.body;
    if(!couponCode || !discountType || !discountValue || !expiryDate || !minPurchaseAmount || !maxDiscount || !usageLimit){
      return res.status(400).json({success:false,message:'Please fill all fields'})
    }
    const couponCodeRegex=/^[A-Z0-9]{6,12}(-[A-Z0-9]{6,12})?$/;
    if(!couponCodeRegex.test(couponCode)){
      return res.status(400).json({success:false,message:'Invalid coupon code'})
    }
    const coupon=await Coupon.findOne({couponCode});
    if(coupon){
      return res.status(400).json({success:false,message:'Coupon code already exists'})
    }
    if (isNaN(discountValue) || discountValue < 0) {
      return res.status(400).json({ success: false, message: 'Discount value must be a valid number and cannot be negative' });
    }
    
    if(minPurchaseAmount<400){
      return res.status(400).json({success:false,message:'Minimum purchase amount cannot be less than 400'})
    }
    if(discountType==='percentage' && discountValue>80){
      return res.status(400).json({success:false,message:'discountvalue in percentage in not greterthan 80'})
    }
    // Check for discount type and validate based on it
    if (discountType === 'percentage') {
      if (discountValue <= 0 || discountValue > 80) {
        return res.status(400).json({ success: false, message: 'Percentage discount value should be between 1 and 80' });
      }
      
    } else if (discountType === 'fixed') {
      if (discountValue <= 0 || discountValue > maxDiscount) {
        return res.status(400).json({ success: false, message: 'Fixed discount value cannot exceed max discount' });
      }
    }
    
    // Global max discount check for both types
    if (maxDiscount > 10000) {
      return res.status(400).json({ success: false, message: 'Maximum discount cannot be greater than 10000' });
    }

    
    if(usageLimit<0){
      return res.status(400).json({success:false,message:'the limit should be greter zero'})
    }
    const parsedExpiryDate = new Date(expiryDate);
    if (isNaN(parsedExpiryDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid expiry date format' });
    }
    if (parsedExpiryDate < new Date()) {
      return res.status(400).json({ success: false, message: 'Expiry date must be in the future' });
    }
    const validDiscountTypes = ['percentage', 'fixed'];
    if (!validDiscountTypes.includes(discountType)) {
      return res.status(400).json({ success: false, message: 'Invalid discount type' });
    }


    const newCoupon=new Coupon({
      couponCode:couponCode,
      discountType:discountType,
      discountValue:discountValue,
      expiryDate: parsedExpiryDate,
      minPurchaseAmount:minPurchaseAmount,
      maxDiscount:maxDiscount,
      usageLimit:usageLimit,

    })
    await newCoupon.save();
    res.status(200).json({success:true,message:'coupon added successfuly'})

  } catch (error) {
    res.status(400).json({success:false,message:error.message})
  }
})

module.exports=router;