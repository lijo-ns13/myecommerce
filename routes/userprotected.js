const express=require('express');
const router=express.Router();

const {jwtAuth,userProtected,adminProtected}=require('../middlewares/auth')

router.use(jwtAuth,userProtected)

router.get('/addcart',async(req,res)=>{
    res.json('cart')
})

module.exports=router;