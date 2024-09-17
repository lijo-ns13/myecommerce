const express=require('express');
const router=express.Router();
const User=require('../models/userSchema')
const {jwtAuth,userProtected}=require('../middlewares/auth')

router.use(jwtAuth,userProtected)

router.get('/',async(req,res)=>{
    console.log(req.user._id)
    const userId=req.user._id;
    const user=await User.findById(userId).populate('address');
    res.render('profile/userprofile',{user:user})
  

})



module.exports=router;