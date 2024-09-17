const express=require('express');
const router=express.Router();
const User=require('../models/userSchema')
const {jwtAuth,userProtected}=require('../middlewares/auth')
const Wishlist=require('../models/wishlistSchema')

router.get('/',async(req,res)=>{
    const user=await User.findById(req.user._id).populate('wishlist');
    res.json(user)
})

router.post('/add/:id',async(req,res)=>{
    try{
        const productId=req.params.id;
        const user=await User.findById({_id:req.user._id})
        let wishlist=await Wishlist.findOne({userId:req.user._id});
        if(wishlist){
            if(wishlist.products.includes(productId)){
                return res.status(400).json({success:false,message:"Already in wishlist"});
            }
            wishlist.products.push(productId);
            
            
        }else{
            wishlist=new Wishlist({userId:req.user._id,products:[productId]});
            
        }
        await wishlist.save();
        res.status(200).json({success:true,message:'successfull added to wishlist'})
    }catch(error){
        res.status(400).json({message:error.message})
    }
})



module.exports=router;