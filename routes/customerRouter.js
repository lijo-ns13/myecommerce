const express=require('express');
const router=express.Router();

const userModel=require('../models/userSchema')

const {jwtAuth,adminProtected}=require('../middlewares/auth')

// Apply middleware to protect all routes
router.use(jwtAuth, adminProtected);

// Get all customers
router.get('/', async(req, res) => {
    // res.send('Retrieve all customers');
    try{
        const users=await userModel.find({role:'user'}).select('+isBlocked')
        res.render('customers',{customers:users})
    }catch(error){
        res.status(400).json({success:false,message:error.message})
    }

});
router.post('/block-user/:id',async(req,res)=>{
    try{
        const userId=req.params.id;

        const user = await userModel.findByIdAndUpdate(userId, { isBlocked: true }, { new: true }).select('+isBlocked').exec();
        console.log(user.isBlocked)
        
        if(!user){
            return res.status(404).json({success:false,message:'User not found'})
        }
        // res.json({success:true,message:'User Blocked Succssfully'});
        res.status(200).redirect('/admin/customers')
    }catch(error){
        res.status(400).json({success:false,message:error.message})
    }
})
router.post('/unblock-user/:id',async(req,res)=>{
    try{
        const userId=req.params.id;
        
        const user = await userModel.findByIdAndUpdate(userId, { isBlocked: false }, { new: true }).select('+isBlocked').exec();
        console.log(user.isBlocked);
        if(!user){
            return res.status(404).json({success:false,message:'User not found'})
        }
        // res.json({success:true,message:'User Unblocked Succssfully'});
        res.status(200).redirect('/admin/customers')
    }catch(error){
        res.status(400).json({success:false,message:error.message})
    }
})
// Get specific customer details
router.get('/customer/:id', (req, res) => {
    res.send('Get specific customer details');
});

// Update customer details
router.patch('/customer/:id', (req, res) => {
    res.send('Update customer details');
});

// Block a customer
router.patch('/customer/block/:id', (req, res) => {
    res.send('Block customer');
});

// Unblock a customer
router.patch('/customer/unblock/:id', (req, res) => {
    res.send('Unblock customer');
});

// Delete a customer
router.delete('/customer/:id', (req, res) => {
    res.send('Delete customer');
});






module.exports=router;