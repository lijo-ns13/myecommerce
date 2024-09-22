const express=require('express');

const User=require('../models/userSchema');
const Address=require('../models/addressSchema')
const {jwtAuth,userProtected}=require('../middlewares/auth');

const getAddress=async(req,res)=>{
    try{
        console.log('clicked')
        console.log('res',req.user._id)
        const user=await User.findById({_id:req.user._id}).populate('address');
        console.log('user',user)
        if(!user){
            return res.status(404).json({message:'User not found'});
        }
        console.log('addy',user.address)
        res.status(200).render('address/address',{user:user})
    }catch(error){
        res.status(500).json({success:false,message:error.message})
    }
}
const getAddAddress=(req,res)=>{
    res.status(200).render('address/add-address')
};
const postAddAddress=async(req,res)=>{
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
        const newAddrs={
            street:street,
            phoneNo:phoneNo,
            city:city,
            state:state,
            postalCode:postalCode,
            country:country,
            user:req.user._id
        }
        const newAddress=await Address.create(newAddrs);
        user.address.push(newAddress._id)
        await user.save();
        res.status(200).json({success:true,message:'new address added succussfull'})
    }catch(error){
        res.status(400).json({success:false,message:error.message})
    }
    
}

const getEditAddress=async(req,res)=>{
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
}
const patchEditAddress=async(req,res)=>{
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
}
const deleteAddress=async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.user._id; // Make sure req.user is populated (e.g., through authentication middleware)

        // Validate addressId and userId
        if (!addressId || !userId) {
            return res.status(400).json({ success: false, message: 'Invalid address ID or user ID' });
        }

        // Find and delete the address
        const address = await Address.findOneAndDelete({ _id: addressId, user: userId });

        if (!address) {
            return res.status(404).json({ success: false, message: 'Address not found or does not belong to the user' });
        }

        res.status(200).json({ success: true, message: 'Address successfully deleted' });
    } catch (error) {
        console.error('Error deleting address:', error); // Log the error for debugging
        res.status(500).json({ success: false, message: 'Server error' });
    }
}


module.exports={
    getAddress,
    getAddAddress,
    postAddAddress,
    getEditAddress,
    patchEditAddress,
    deleteAddress

}