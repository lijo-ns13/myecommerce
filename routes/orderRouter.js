const express=require('express');

const Order=require('../models/orderSchema')
const Product=require('../models/productSchema')
const router=express.Router();

const {jwtAuth,userProtected}=require('../middlewares/auth')

router.get('/',async(req,res)=>{
    try{
        const orders=await Order.find({userId:req.user._id}).populate('products.productId')
        res.render('orders',{orders:orders})
        
    }catch(error){
        res.status(400).json({success:false,message:error.message})
    }
})

// In your routes file

router.post('/:orderId/cancel', async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Order cannot be cancelled' });
        }

        order.status = 'cancelled';
        await order.save();

      // Rebuild stock levels for each product in the order
      for (const item of order.products) {
        const product = await Product.findById(item.productId._id);

        if (product) {
            const sizeIndex = product.sizes.findIndex(size => size.size === item.size);

            if (sizeIndex !== -1) {
                product.sizes[sizeIndex].stock += item.quantity;
            } else {
                // Handle case if size does not exist
                // Ensure the size field is not empty and add it only if valid
                if (item.size) {
                    product.sizes.push({ size: item.size, stock: item.quantity });
                } else {
                    console.error(`Size ${item.size} is not valid for product ${product._id}`);
                }
            }

            await product.save();
        }
      }
      res.status(200).json({success:true,message:'successfuly cancelled product'})
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});


module.exports=router;