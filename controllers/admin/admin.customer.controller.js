
const User=require('../../models/userSchema')

const getCustomers=async(req, res) => {
    // res.send('Retrieve all customers');
    try{
        const users=await User.find({role:'user'}).select('+isBlocked')
        res.render('customers',{customers:users})
    }catch(error){
        res.status(400).json({success:false,message:error.message})
    }

}
const postCustomerBlock=async(req,res)=>{
    try{
        const userId=req.params.id;

        const user = await User.findByIdAndUpdate(userId, { isBlocked: true }, { new: true }).select('+isBlocked').exec();
        console.log(user.isBlocked)
        
        if(!user){
            return res.status(404).json({success:false,message:'User not found'})
        }
        // res.json({success:true,message:'User Blocked Succssfully'});
        res.status(200).redirect('/admin/customers')
    }catch(error){
        res.status(400).json({success:false,message:error.message})
    }
}
const postCustomerUnblock=async(req,res)=>{
    try{
        const userId=req.params.id;
        
        const user = await User.findByIdAndUpdate(userId, { isBlocked: false }, { new: true }).select('+isBlocked').exec();
        console.log(user.isBlocked);
        if(!user){
            return res.status(404).json({success:false,message:'User not found'})
        }
        // res.json({success:true,message:'User Unblocked Succssfully'});
        res.status(200).redirect('/admin/customers')
    }catch(error){
        res.status(400).json({success:false,message:error.message})
    }
}
module.exports={
    getCustomers,
    postCustomerBlock,
    postCustomerUnblock,
}