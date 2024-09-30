const express=require('express');
const userModel=require('../models/userSchema')
const Products=require('../models/productSchema')
const JWT=require('jsonwebtoken');
const bcrypt=require('bcrypt');
const dotenv=require('dotenv').config();
const cookieParser=require('cookie-parser');
const Category=require('../models/categorySchema')
const Cart=require('../models/cartSchema')
const router=express.Router();
router.use(cookieParser())

// const {jwtAuth}=require('../middlewares/auth')

const {getProductsWithOffers}=require('../services/productService');
const app = require('../app');

// router.use(jwtAuth)

router.get('/',async(req,res)=>{
    const products=await Products.find({isListed:true}).limit(5)
    // const products=await Products.find({});
    // res.json(products);
    console.log('products',products)
    const cart=await Cart.find({});
    console.log('cart',cart);
    // console.log('requser',req.user._id)
    // let cartLength;
    // if(req.user){
    //     cartLength = cart.length > 0 && cart[0].products ? cart[0].products.length : 0 ;
    // }else{
    //     cartLength=1;
    // }
    
    // console.log('cartlen',cart[0].products.length)
    // const cartLength=cart.products.length();
    res.render('land',{products:products});
})
router.get('/product-detail/:productId',async(req,res)=>{
    const productId=req.params.productId;
    const product=await Products.findById(productId);
    const offerProducts=await getProductsWithOffers();
    let check=false;
    let producty=[];
    console.log('ofy',offerProducts)
    for(const pro of offerProducts){
        if(pro._id==productId){
            if(pro.offerApplied===true){
                check=true;
                producty=pro;
                
            }else{
                producty=pro;
                check=false;
            }
        }
    }
    
    
    const categoryId=product.category;
    console.log(categoryId)

    const relatedProducts=await Products.find({category:categoryId});
    console.log(relatedProducts)

    const cart=await Cart.find({});
    console.log('cart',cart)
    // let cartLength;
    // if(req.user){
    //     cartLength = cart.length > 0 && cart[0].products ? cart[0].products.length : 0 ;
    // }else{
    //     cartLength=0;
    // }
    // console.log('cartlen',cart[0].products.length)
    // console.log(product)
    // res.json(product)
    if(check){
        res.render('product-detailed',{product:producty,relatedProducts:relatedProducts,isOffer:true})
    }else{
        res.render('product-detailed',{product:producty,relatedProducts:relatedProducts,isOffer:false})
    }
    
})
router.get('/products', async (req, res) => {
    const cart=await Cart.find({});
    console.log('cart',cart)
    let cartLength;
    // if(req.user){
    //     cartLength = cart.length > 0 && cart[0].products ? cart[0].products.length : 0 ;
    // }else{
    //     cartLength=0;
    // }
    // console.log('cartlen',cart[0].products.length)
    const { query = '', category = '', sort = '' } = req.query;
    let filter = {};
    let sortOption = {};

    // Prepare search filter
    if (query) {
        filter.product = { $regex: query, $options: 'i' }; // Case-insensitive search
    }

    // Filter by category if specified
    if (category) {
        filter.category = category;
    }

    // Sorting options
    const sortOptionsMap = {
        price_low_high: { price: 1 },
        price_high_low: { price: -1 },
        rating: { rating: -1 },
        featured: { featured: -1 },
        new_arrivals: { createdAt: -1 },
        a_z: { product: 1 },
        z_a: { product: -1 },
        popularity: { popularity: -1 },
    };
    
    sortOption = sortOptionsMap[sort] || {}; // Default sorting or no sorting

    // Fetch categories for dropdown
    const categories = await Category.find(); // Assuming Categories is your category model

    // Fetch products based on filter and sort
    const products = await Products.find(filter).sort(sortOption);

    // Pass search query, selected category, and sorting to the view
    res.render('fullproducts', {
        products,
        categories,
        searchQuery: query,
        selectedCategory: category,
        selectedSort: sort
    });
});

router.get('/offerproducts',async(req,res)=>{
    const productsWithOffers=await getProductsWithOffers();
    res.json(productsWithOffers)
})


module.exports=router;