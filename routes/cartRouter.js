const express=require('express');
const router=express.Router();
const Product=require('../models/productSchema');
const Cart=require('../models/cartSchema')
const {jwtAuth,userProtected}=require('../middlewares/auth')

router.use(jwtAuth,userProtected)

router.get('/',async(req,res)=>{
    try{
   
        const cart=await Cart.findOne({userId:req.user._id}).populate('products.productId');
        
        if (!cart) {
            cart = { products: [] };
        }
        console.log('cart',cart)
        
        res.render('cart/cart',{cart})
    }catch(error){
        res.status(500).send({message:error.message})
    }
})

router.post('/add', async (req, res) => {
    try {
        const { productId, size } = req.body;
        console.log("Received - Product ID:", productId, "Size:", size);

        if (!productId || !size) {
            return res.status(400).json({ success: false, message: 'Product ID and size are required' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        let cart = await Cart.findOne({ userId: req.user._id });

        if (!cart) {
            cart = new Cart({ userId: req.user._id, products: [] });
        }

        // Log current cart contents
        console.log("Current Cart Products:", cart.products);

        // Check if the product with the specified size is already in the cart
        const existingItem = cart.products.find(pro => {
            console.log("Comparing - Product ID:", pro.productId.toString(), "Size:", pro.size);
            return pro.productId.toString() === productId && pro.size === size;
        });

        if (existingItem) {
            console.log("Item already in cart:", existingItem);
            return res.status(400).json({ success: false, message: 'Product with this size already in cart' });
        } else {
            console.log("Adding new item to cart");
            // Add the new item to the cart
            cart.products.push({ productId: productId, size: size, quantity: 1 });
        }

        await cart.save();
        console.log("Cart after update:", cart);

        res.status(200).json({ success: true, message: 'Product added to cart' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// /cart/delete/66d84f7612a95a6dea0303a6
router.post('/delete/:id',async(req,res)=>{
    try{
        const productId=req.params.id;
        const cart=await Cart.findOne({userId:req.user._id});
        if(!cart){
            return res.status(404).send({message:'Cart not found'});
        }
        const productIndex=cart.products.findIndex(p=>p.productId.toString()===productId);
        console.log(productIndex)
        if(!productIndex){
            return res.status(404).send({message:'Product not found in cart'});
        }
        cart.products.splice(productIndex,1);
        await cart.save()
        // res.status(200).send({success:true,message:'Product deleted from cart'});
        res.status(200).redirect('/cart')
    }catch(error){

    }
})

router.post('/updateQuantity/:productId/:size', async (req, res) => {
    try {
        const action = req.body.action; // 'increase' or 'decrease'
        const { productId, size } = req.params; // Extract from URL params

        // Find the active cart for the user
        const cart = await Cart.findOne({ userId: req.user._id, status: 'active' });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        // Find the product in the cart
        const product = cart.products.find(p => p.productId.toString() === productId && p.size.toString() === size.toString());
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found in cart' });
        }
        const productDetails = await Product.findById(productId);
        if (!productDetails) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        console.log('productdeaild',productDetails)
        const sizeDetails = productDetails.sizes.find(s => s.size === parseInt(size));
        if (!sizeDetails) {
            return res.status(404).json({ success: false, message: 'Size not found' });
        }
         // Check stock availability

        if (action === 'increase') {
            if (product.quantity >= sizeDetails.stock) {
                return res.status(400).json({ success: false, message: 'Not enough stock available' });
            }
            product.quantity += 1;
        } else if (action === 'decrease') {
            if (product.quantity > 1) {
                product.quantity -= 1;
            } else {
                return res.status(400).json({ success: false, message: 'Cannot reduce quantity below 1' });
            }
        }

        // Save the updated cart
        // cart.totalPrice = cart.products.reduce((total, item) => total + item.productId.price * item.quantity, 0);
        
        await cart.save();
        res.status(200).json({ success: true, message: 'Quantity updated' });

    } catch (error) {
        console.error(error); // Log error for debugging
        res.status(500).json({ success: false, message: 'Server error' });
    }
});



// router.post('/quantityupdate/:id/:size', async (req, res) => {
//     try {
//         const action = req.body.action; // Can be 'increase' or 'decrease'
//         const productId = req.params.id;
//         const size = req.params.size; // Added size parameter

//         // Find the active cart for the user
//         const cart = await Cart.findOne({ userId: req.user._id, status: 'active' });
//         if (!cart) {
//             return res.status(404).json({ success: false, message: 'Cart not found' });
//         }

//         // Find the product in the cart by both productId and size
//         const product = cart.products.find(p => p.productId.toString() === productId && p.size === size);
//         if (!product) {
//             return res.status(404).json({ success: false, message: 'Product with specified size not found in cart' });
//         }

//         // Adjust the quantity based on the action
//         if (action === 'increase') {
//             product.quantity += 1;
//         } else if (action === 'decrease' && product.quantity > 1) {
//             product.quantity -= 1;
//         } else if (action === 'decrease' && product.quantity === 1) {
//             return res.status(400).json({ success: false, message: 'Cannot reduce quantity below 1' });
//         } else {
//             return res.status(400).json({ success: false, message: 'Invalid action' });
//         }

//         // Save the updated cart
//         await cart.save();
//         res.status(200).json({ success: true, message: 'Quantity updated' });

//     } catch (error) {
//         console.error(error); // Log error for debugging
//         res.status(500).json({ success: false, message: error.message });
//     }
// });

module.exports=router;


