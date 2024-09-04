// const express=require('express');
// const router=express.Router();
// const Products=require('../models/productSchema');
// const Category=require('../models/categorySchema')


// router.get('/',async(req,res)=>{
//     const products=await Products.find({}).limit(5);
//     // res.json(products);
//     res.render('land',{products:products});
// })
// router.get('/product-detail/:productId',async(req,res)=>{
//     const productId=req.params.productId;
//     const product=await Products.findById(productId);
//     const categoryId=product.category;
//     console.log(categoryId)

//     const relatedProducts=await Products.find({category:categoryId});
//     console.log(relatedProducts)
//     // console.log(product)
//     // res.json(product)
//     res.render('product-detailed',{product:product,relatedProducts:relatedProducts})
// })
// router.get('/products',async(req,res)=>{
//     const products=await Products.find({});
//     // res.json(products)
//     res.render('fullproducts')
// })

// module.exports=router;