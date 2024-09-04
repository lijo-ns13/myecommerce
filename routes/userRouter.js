const express=require('express');
const userModel=require('../models/userSchema')
const Products=require('../models/productSchema')
const JWT=require('jsonwebtoken');
const bcrypt=require('bcrypt');
const dotenv=require('dotenv').config();
const cookieParser=require('cookie-parser');
const {jwtAuth,adminProtected,userProtected}=require('../middlewares/auth');

const router=express.Router();
router.use(cookieParser())
// router.use(jwtAuth,userProtected);



router.get('/',async(req,res)=>{
    const products=await Products.find({isListed:true}).limit(5);
    // res.json(products);
    res.render('land',{products:products});
})
router.get('/product-detail/:productId',async(req,res)=>{
    const productId=req.params.productId;
    const product=await Products.findById(productId);
    const categoryId=product.category;
    console.log(categoryId)

    const relatedProducts=await Products.find({category:categoryId});
    console.log(relatedProducts)
    // console.log(product)
    // res.json(product)
    res.render('product-detailed',{product:product,relatedProducts:relatedProducts})
})
router.get('/products',async(req,res)=>{
    const products=await Products.find({isListed:true});
    // res.json(products)
    res.render('fullproducts',{products:products})
})



module.exports=router;