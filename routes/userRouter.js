const express=require('express');
const userModel=require('../models/userSchema')
const Products=require('../models/productSchema')
const JWT=require('jsonwebtoken');
const bcrypt=require('bcrypt');
const dotenv=require('dotenv').config();
const cookieParser=require('cookie-parser');
const Category=require('../models/categorySchema')

const router=express.Router();
router.use(cookieParser())




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
router.get('/products', async (req, res) => {
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
    switch (sort) {
        case 'price_low_high':
            sortOption = { price: 1 };
            break;
        case 'price_high_low':
            sortOption = { price: -1 };
            break;
        case 'rating':
            sortOption = { rating: -1 };
            break;
        case 'featured':
            sortOption = { featured: -1 }; // Assuming 'featured' is a boolean or numeric field
            break;
        case 'new_arrivals':
            sortOption = { createdAt: -1 }; // Assuming products have a 'createdAt' field
            break;
        case 'a_z':
            sortOption = { product: 1 };
            break;
        case 'z_a':
            sortOption = { product: -1 };
            break;
        case 'popularity':
            sortOption = { popularity: -1 }; // Assuming 'popularity' is a field
            break;
        default:
            sortOption = {}; // Default sorting or no sorting
            break;
    }

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



module.exports=router;