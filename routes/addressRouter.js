const express=require('express');
const router=express.Router();
const User=require('../models/userSchema');
const Address=require('../models/addressSchema')
const {jwtAuth,userProtected}=require('../middlewares/auth');

router.get('/',async(req,res)=>{
    try{
        const user=await User.findById({_id:req.user._id}).populate('address');
        if(!user){
            return res.status(404).json({message:'User not found'});
        }
        console.log('addy',user.address)
        res.status(200).render('address/address',{user:user})
    }catch(error){
        res.status(500).json({success:false,message:error.message})
    }
})
router.get('/add-address',(req,res)=>{
    res.status(200).render('address/add-address')
})
router.post('/add-address',async(req,res)=>{
    try{
        const userId=req.user._id;
   
        const {street,phoneNo,city,state,postalCode,country}=req.body;
        console.log(req.body)
        if(!phoneNo || !street || !city || !state || !postalCode || !country){
            return res.status(400).json({success:false,message:'All fields are required'})
        }
        const phoneRegex = /^(\+91[\s.-]?)?((\d{5}[\s.-]?\d{5})|\d{10})$/;
        if(!phoneRegex.test(phoneNo)){
            return res.status(400).json({success:false,message:'Invalid phone number'})
        }
        const user=await User.findById(userId);
        if(!user){
            return res.status(404).json({success:false,message:'user not found'})
        }
        const newAddress=await Address.create(req.body);
        user.address.push(newAddress._id)
        await user.save();
        res.status(200).json({success:true,message:'new address added succussfull'})
    }catch(error){
        res.status(400).json({success:false,message:error.message})
    }
    
})
router.get('/edit-address/:id',async(req,res)=>{
    try{
        const id=req.params.id;
        const address=await Address.findById(id);
        if(!address){
            return res.status(404).json({success:false,message:'address not found'})
        }
        res.render('address/edit-address',{address:address})
    }catch(error){
        res.status(400).json({success:false,message:error.message})
    }
})
router.patch('/edit-address/:id',async(req,res)=>{
    try{
        const addressId=req.params.id;
        const userId=req.user._id;
        const {street,phoneNo,city,state,postalCode,country}=req.body;
        console.log('ar',req.body)
        if(!street || !phoneNo || !city || !state || !postalCode || !country){
            return res.status(400).json({success:false,message:'Please fill every fields'})
        }
        const phoneRegex = /^(\+91[\s.-]?)?((\d{5}[\s.-]?\d{5})|\d{10})$/;
        if(!phoneRegex.test(phoneNo)){
            return res.status(400).json({success:false,message:'Invalid phone number'})
        }
        const address=await Address.findById(addressId);
        if(!address){
            return res.status(400).json({success:false,message:error.message})
        }
        await Address.findByIdAndUpdate(addressId,req.body,{new:true})
        res.status(200).json({success:true,message:'successfuly updated address'})
    }catch(error){
        return res.status(400).json({success:false,message:error.message})
    }
})
// /user/address/delete-address/66e9014cf370838638fb41ea
router.delete('/delete-address/:id',async(req,res)=>{
    try{
        const productId=req.params.id;
        const userId=req.user._id;
        await Address.findByIdAndDelete(productId)
        res.status(200).json({success:true,message:'successfully deleted'})
    }catch(error){
        return res.status(400).json({success:false,message:error.message})
    }
})


module.exports=router;

