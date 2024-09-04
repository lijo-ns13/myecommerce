const express=require('express');
const router=express.Router();
const Product=require('../models/productSchema');
const Cart=require('../models/cartSchema')
const {jwtAuth,userProtected}=require('../middlewares/auth')

router.use(jwtAuth,userProtected)

router.get('/',async(req,res)=>{
    try{
        console.log('hi1')
        const cart=await Cart.findOne({userId:req.user._id}).populate('products.productId');
        console.log('hi')
        if (!cart) {
            cart = { products: [] };
        }
        console.log('cart',cart)
        
        res.render('cart/cart',{cart})
    }catch(error){
        res.status(500).send({message:error.message})
    }
})

router.post('/add', async (req, res) => {
    try {
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).send({ message: 'Product id is required' });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send({ message: 'Product not found' });
        }

        // Find the user's cart
        let cart = await Cart.findOne({ userId: req.user._id });

        if (!cart) {
            // If no cart exists, create a new one
            cart = new Cart({ userId: req.user._id, products: [] });
        }

        // Check if the product is already in the cart
        const existingItem = cart.products.find(pro => pro.productId.equals(productId));

        if (existingItem) {
            return res.status(400).json({ success: false, message: 'Already in cart' });
        } else {
            // Add the product to the cart
            cart.products.push({ productId: productId, quantity: 1 });
        }

        // Save the cart
        await cart.save();
        res.status(200).send({ success: true, message: 'Product added to cart' });
    } catch (error) {
        console.error(error); // For better debugging
        res.status(500).send({ success: false, message: 'Server error' });
    }
});

module.exports=router;


