const express = require('express');
const router = express.Router();

const { jwtAuth, userProtected } = require('../middlewares/auth');

const User = require('../models/userSchema');
const Cart = require('../models/cartSchema');
const Product = require('../models/productSchema');
const Order = require('../models/orderSchema');
const Address=require('../models/addressSchema')
// Apply JWT authentication and protect the routes
router.use(jwtAuth, userProtected);

router.get('/',async(req,res)=>{
    try {
        const userId = req.user._id; // Assuming user is authenticated and user ID is available from the session or JWT

        // Fetch cart details for the user
        const cart = await Cart.findOne({ userId }).populate('products.productId');
        if (!cart || cart.products.length === 0) {
            return res.redirect('/cart'); // Redirect to cart if it's empty
        }

        // Fetch user details and addresses
        const user = await User.findById(userId).populate('address');
        if (!user) {
            return res.redirect('/auth/signin'); // Redirect to sign-in if user is not found
        }

        // Render the checkout page with cart and user data
        res.render('checkout', {
            cart,
            user
        });
    } catch (error) {
        console.error('Error fetching checkout data:', error);
        res.status(500).send('Something went wrong. Please try again later.');
    }
})
router.post('/',async(req,res)=>{
    try {
        console.log('reqty',req.body)
        const userId=req.user._id;
        const {selectedAddress, paymentMethod}=req.body
        console.log('req.bdoy',req.body)
        console.log(paymentMethod)
        // const cart =await Cart.findById({userId:userId}).populate('products.productId');
        const cart= await Cart.findOne({userId})
        console.log('cart',cart)
        if(!cart || cart.products.length===0){
            return res.status(400).json({success:false,message:'Your cart is empty4'})
        }
        const totalPrice=cart.totalPrice;

        const user=await User.findById(userId).populate('address');
        console.log('selected',selectedAddress)
        if(!selectedAddress){
            return res.status(400).json({success:false,message:'Please select a selected address'})
        }
        const address=await Address.findById(selectedAddress);
        
        const shippedAddress={
            phoneNo:address.phoneNo,
            street:address.street,
            city:address.city,
            state:address.state,
            postalCode:address.postalCode,
            country:address.country
        }
        console.log('shippeda',shippedAddress)
        const newOrder=new Order({
            userId:userId,
            products:cart.products,
            totalPrice:totalPrice,
            shippingAddress:shippedAddress,
            paymentMethod:paymentMethod
        })
        await newOrder.save();
        await Cart.deleteOne({ userId });
        for (const product of cart.products) {
            await Product.findByIdAndUpdate(product.productId._id, {
                $inc: { stock: -product.quantity } // Decrease stock by quantity purchased
            });
        }
        res.status(201).json({success:true,message:'Order placed successfully'})
    } catch (error) {
        res.status(400).json({success:false,message:error.message})
    }
})


module.exports = router;
