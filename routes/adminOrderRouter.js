const express=require('express');

const Order=require('../models/orderSchema')

const router=express.Router();

const {jwtAuth,adminProtected}=require('../middlewares/auth');

router.get('/',async(req,res)=>{
    try{
        const orders=await Order.find({});
        res.render('adminorders/orders',{orders:orders})
    }catch(error){

    }
})


module.exports=router;