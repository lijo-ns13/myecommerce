const express=require('express');

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const methodOverride=require('method-override')
const Product = require('../models/productSchema'); // Adjust the path to your Product model
const Category=require('../models/categorySchema')
const User=require('../models/userSchema')
const userModel=require('../models/userSchema')
const Order=require('../models/orderSchema');
const Wallet=require('../models/walletSchema')

const {jwtAuth,adminProtected,userProtected}=require('../middlewares/auth');

const dotenv=require('dotenv').config()

const nodemailer = require('nodemailer');
const uploadsDir = path.join(__dirname,'../public/uploads');

const getProduct = async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Get the current page from query params, default to 1
  const limit = 10; // Number of products per page
  const skip = (page - 1) * limit; // Calculate the number of products to skip

  const products = await Product.find({}).populate('category').skip(skip).limit(limit);
  const totalProducts = await Product.countDocuments({}); // Get total product count
  const totalPages = Math.ceil(totalProducts / limit); // Calculate total pages

  res.render('pro/products', {
      products: products,
      currentPage: page,
      totalPages: totalPages
  });
};
const getViewProduct=async(req,res)=>{
    const products=await Product.find({});
    // res.json(products)
    res.render('viewproducts',{products:products})
  }
const getAddProduct=async(req,res)=>{
    try{
        const categories=await Category.find({});
        res.status(200).render('add-product',{categories:categories})
    }catch(error){
      res.status(400).json({success:false,message:error.message})
    }
}
// Ensure the upload directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  // Multer setup for file uploads
  const upload = multer({ dest: 'public/uploads/' });
  
  // Function to save base64 image data
  const saveBase64Image = async (dataUrl, filename) => {
    if (!dataUrl || typeof dataUrl !== 'string') {
      throw new Error('Invalid base64 image data');
    }
  
    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 image data format');
    }
  
    const fileExtension = matches[1] || 'jpeg'; // Default to jpeg if unspecified
    const base64Data = matches[2].replace(/\s/g, ''); // Remove whitespace
  
    const filePath = path.join(uploadsDir, `${filename}.${fileExtension}`);
  
    try {
      await sharp(Buffer.from(base64Data, 'base64')).toFile(filePath);
    } catch (error) {
      console.error('Error saving image with sharp:', error);
      throw new Error('Failed to save image');
    }
  
    return filePath;
  };

const postAddProduct=async (req, res) => {
    try {
      const { product, brand, description, price,category, croppedImages } = req.body;
      
  
      // Initialize images array
      let images = [];
  
      // Process uploaded files (regular images)
      if (req.files) {
        images = req.files.map(file => ({
          id: file.filename,
          secured_url: `uploads/${file.filename}`,
        }));
      }
  
      // Process cropped images
      if (croppedImages) {
        const croppedImagesArray = JSON.parse(croppedImages);
  
        // Clear out existing images if there are cropped images
        images = [];
  
        for (const imgData of croppedImagesArray) {
          const filename = generateUniqueFilename();
          const filePath = await saveBase64Image(imgData, filename);
  
          const fileExtension = path.extname(filePath).slice(1); // Extract file extension
          images.push({
            id: filename,
            secured_url: `uploads/${filename}.${fileExtension}`,
          });
        }
      }
      if(!product || !brand || !description || !price  || !category || !croppedImages){
        return res.status(400).json({ status:false,message: 'Please fill all fieldss' });
      }
      const productRegex=/^[a-zA-Z0-9 _'-]{2,100}$/
  
      if(!productRegex.test(product)){
        return res.status(400).json({ success:false,message: 'Product name should only contain letters, numbers'});
      }
      if(product.length<4){
        return res.status(400).json({success:false,message:'Product name atleast 4 characters'})
      }
      const brandRegex=/^[a-zA-Z0-9][a-zA-Z0-9 &-]{1,48}[a-zA-Z0-9]$/
      if(!brandRegex.test(brand)){
        return res.status(400).json({ success:false,message: 'Brand name should only contain letters'})
      }
      if(brand.length<4){
        return res.status(400).json({success:false,message:'Brand atleast have 4 characters'})
      }
      if(description.length<8){
        return res.status(400).json({success:false,message:'Description atleat have 8 characters'})
      }
      if(Number(price)<0){
        return res.status(400).json({ success:false,message: 'Price should be greater than zero'});
      }
      const sizes = req.body.sizes.map(sizeObj => ({
        size: Number(sizeObj.size),
        stock: Number(sizeObj.stock),
      }));
      if(!sizes || sizes.length==0){
        return res.status(400).json({success:false,message:'add atleast one size and stock'})
      }
      
        let errors = [];
  
      // Validate sizes and stock
      for (const size of sizes) {
          if (size.size <= 0) {
              errors.push('Size must be greater than 0');
          }
          if (size.stock < 0) {
              errors.push('Stock must be 0 or greater');
          }
      }
  
      if (errors.length > 0) {
          return res.status(400).json({ success: false, message: errors.join(', ') });
      }
    
  
      // Create and save the product with images (only cropped images)
      const newProduct = new Product({
        product,
        brand,
        description,
        price: Number(price),
        finalPrice:price,
        sizes,
        category,
        images
      });
  
      await newProduct.save();
      res.status(200).json({success:true, message: 'Product added successfully!' });
      // res.status(200).render('pro/addproductsuccess')
    } catch (error) {
      console.error('Error adding product:', error);
      res.status(500).json({success:false, message: 'Failed to add product', error: error.message });
    }
  }
  const generateUniqueFilename = () => {
    return `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
  };
const postUnlist=async(req,res)=>{
    try{
      const productId=req.params.id;
      const product=await Product.findOneAndUpdate(
        {_id:productId},{isListed:false},{new:true}
      )
      if(!product){
        return res.status(404).json({success:false,message:'Product not found'})
      }
      // res.status(200).render('pro/unlistproductsuccess')
      res.status(200).json({success:true,message:'unlisted successfully'})
    }catch(error){
      res.status(400).json({success:false,message:error.message})
    }
  }
const postList=async(req,res)=>{
    try{
      const productId=req.params.id;
      const product=await Product.findOneAndUpdate(
        {_id:productId},{isListed:true},{new:true}
      )
      if(!product){
        return res.status(404).json({success:false,message:'Product not found'})
      }
      // res.status(200).render('pro/listproductsuccess')
      res.status(200).json({success:true,message:'listed successfully'})
    }catch(error){
      res.status(400).json({success:false,message:error.message})
    }
  }
const getProductEdit=async(req,res)=>{
    try {
      const productId=req.params.id;
      const categories=await Category.find({})
      const product = await Product.findById(productId);
      res.render('pro/updateproduct', { product,categories });
  } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
  }
  }
  const patchProductEdit = async (req, res) => {
    try {
      const { product, brand, description, price, category, croppedImages } = req.body;
  
      // Ensure you have the product ID in the request (for example, via req.params)
      const productId = req.params.id; // Adjust this based on how you're sending the ID
  
      // Check if the product exists
      const existingProduct = await Product.findById(productId);
      if (!existingProduct) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
  
      // Initialize images array with existing images
      let images = [...existingProduct.images]; // Start with existing images
  
      // Process cropped images only
      if (croppedImages) {
        const croppedImagesArray = JSON.parse(croppedImages);
  
        for (const imgData of croppedImagesArray) {
          const filename = generateUniqueFilename();
          const filePath = await saveBase64Image(imgData, filename);
          const fileExtension = path.extname(filePath).slice(1);
          
          // Add the cropped image to the images array
          images.push({
            id: filename,
            secured_url: `/uploads/${filename}.${fileExtension}`,
          });
        }
      }
  
      // Validation checks for required fields
      if (!product || !brand || !description || !price || !category) {
        return res.status(400).json({ success: false, message: 'Please fill all fields' });
      }
      const productRegex=/^[a-zA-Z0-9 _'-]{2,100}$/
  
      if(!productRegex.test(product)){
        return res.status(400).json({ success:false,message: 'Product name should only contain letters, numbers'});
      }
      if(product.length<4){
        return res.status(400).json({success:false,message:'Product name atleast 4 characters'})
      }
      const brandRegex=/^[a-zA-Z0-9][a-zA-Z0-9 &-]{1,48}[a-zA-Z0-9]$/
      if(!brandRegex.test(brand)){
        return res.status(400).json({ success:false,message: 'Brand name should only contain letters'})
      }
      if(brand.length<4){
        return res.status(400).json({success:false,message:'Brand atleast have 4 characters'})
      }
      if(description.length<8){
        return res.status(400).json({success:false,message:'Description atleat have 8 characters'})
      }
      if(Number(price)<0){
        return res.status(400).json({ success:false,message: 'Price should be greater than zero'});
      }
      // Validate sizes from the request body
      const sizes = req.body.sizes; // Ensure sizes is correctly assigned

      if (!Array.isArray(sizes)) {
        return res.status(400).json({ success: false, message: 'Sizes must be an array.' });
      }
      
      // Filter out any invalid or empty size entries, if necessary
      const filteredSizes = sizes.filter(sizeObj => sizeObj.size && sizeObj.stock);
      
      // If all sizes have been removed, send an error
      if (filteredSizes.length === 0) {
        return res.status(400).json({ success: false, message: 'Add at least one size and stock' });
      }
      
      const sizesArray = filteredSizes.map(sizeObj => {
        const size = Number(sizeObj.size);
        const stock = Number(sizeObj.stock);
        
        if (isNaN(size) || isNaN(stock)) {
          throw new Error('Size and stock must be valid numbers.');
        }
        
        return { size, stock };
      });
      
      let errors = [];
      
      // Validate sizes and stock
      for (const size of sizesArray) {
        if (size.size <= 0) {
          errors.push('Size must be greater than 0');
        }
        if (size.stock < 0) {
          errors.push('Stock must be 0 or greater');
        }
      }
      
      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: errors.join(', ') });
      }
      

      // Update the existing product
      existingProduct.product = product;
      existingProduct.brand = brand;
      existingProduct.description = description;
      existingProduct.price = Number(price);
      existingProduct.sizes = sizesArray;
      existingProduct.finalPrice = Number(price);
      existingProduct.category = category;
      existingProduct.images = images; // Keep existing images and add new cropped images
  
      // Save the updated product
      await existingProduct.save();
  
      res.status(200).json({ success: true, message: 'Product updated successfully!' });
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ success: false, message: 'Failed to update product', error: error.message });
    }
  };
  



//   customer section *********************************************************

const getCustomers=async(req, res) => {
    // res.send('Retrieve all customers');
    try{
        const users=await userModel.find({role:'user'}).select('+isBlocked')
        res.render('customers',{customers:users})
    }catch(error){
        res.status(400).json({success:false,message:error.message})
    }

}
const postCustomerBlock=async(req,res)=>{
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
}
const postCustomerUnblock=async(req,res)=>{
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
}
// category********************************

const getCategory=async(req,res)=>{
    const categories=await Category.find();

    res.render('category',{categories:categories})
}
const getCategoryUpdate=async(req,res)=>{
    const id=req.params.id;
    const category=await Category.findById(id);
    res.render('update-category',{category})
}
const patchCategoryUpdate=async(req,res)=>{
    const categoryId=req.params.id;
    const category=await Category.findByIdAndUpdate(categoryId,req.body,{new:true})
    if(!category){
        return res.status(404).send({message:'Category not found'})
    }
    res.status(200).json({success:true,message:'Category updated successfully',category:category})
}
// const deleteCategoryDelete=async(req,res)=>{
//     try{
//         const categoryId=req.params.id;
//     const category=await Category.findByIdAndDelete(categoryId);
//     if(!category){
//         return res.status(404).render('category/error',{success:false,message:'category not found'})
//     }
//     // res.status(200).render('category/success',{success:true,message:'successfully deleted'})
//     res.status(200).json({success:true,message:'Deleted Successfully'})
//     }catch (error) {
//       console.error('Error:', error); // Log the full error
//       res.status(500).json({ success: false, message: error.message });
//   }
// }
const postCategoryBlock=async(req,res)=>{
  try {
      const categoryId=req.params.id;
      const category=await Category.findById({_id:categoryId});
      if(!category){
        return res.status(400).json({success:false,message:"Category not found"})
      }
      const upCategory=await Category.findByIdAndUpdate(categoryId,{isBlocked:true},{new:true});
      if(!upCategory){
        return res.status(400).json({success:false,message:'not updating and not find categoryId'})
      }
      res.status(200).json({success:true,message:'Category is Blocked'})
      // res.status(200).redirect('/admin/category')

  } catch (error) {
    console.log('Error from category Block',error.message);
    res.status(400).json({success:false,message:error.message})
  }
}
const postCategoryUnblock=async(req,res)=>{
  try {
    const categoryId=req.params.id;
      const category=await Category.findById({_id:categoryId});
      if(!category){
        return res.status(400).json({success:false,message:"Category not found"})
      }
      const upCategory=await Category.findByIdAndUpdate(categoryId,{isBlocked:false},{new:true});
      if(!upCategory){
        return res.status(400).json({success:false,message:'not updating and not find categoryId'})
      }
      res.status(200).json({success:true,message:'Category is Unblocked'})
      // res.status(200).redirect('/admin/category')
  } catch (error) {
    console.log('Error from category Block',error.message);
    res.status(400).json({success:false,message:error.message})
  }

}
const getAddCategory=(req,res)=>{
    res.render('add-category')
}
const postAddCategory=async(req,res)=>{
    try{
        const {name,description}=req.body;
        if(!name || !description){
            return res.status(400).json({success:false,message:'category and description are required'})
        }
        const categoryExist=await Category.findOne({name}) 
        if(categoryExist){
            return res.status(400).json({success:false,message:'category already exist'})
        }
        const newCategory = new Category(req.body);
        await newCategory.save();
        res.status(200).json({ success: true, message: 'Category added successfully' });
    }catch(error){
        res.status(400).json({success:false,message:error.message})
    }
}


// orders/********************** */

const getOrders = async (req, res) => {
  try {
      const page = parseInt(req.query.page) || 1; // Current page number
      const limit = parseInt(req.query.limit) || 10; // Number of orders per page
      const skip = (page - 1) * limit; // Calculate skip value

      const totalOrders = await Order.countDocuments(); // Total number of orders
      const totalPages = Math.ceil(totalOrders / limit); // Total number of pages

      const orders = await Order.find({})
          .skip(skip) // Skip the orders based on the current page
          .limit(limit) // Limit the number of orders returned
          .populate({
              path: 'userId',
              select: 'name'
          })
          .populate({
              path: 'products.productId',
              select: 'product'
          });

      res.render('adminorders/orders', { orders, currentPage: page, totalPages });
  } catch (error) {
      res.status(500).json({ success: false, message: error.message });
  }
};

const getEditOrder=async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);
  
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
  
        res.render('adminorders/edit', { order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
  }
  const postEditOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body; 
      console.log('status',status)
        const order = await Order.findById(orderId).populate('products.productId'); // Populate product details

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Check if the order status is payment_failed
        if (order.status === 'payment_failed') {
            return res.status(400).json({ success: false, message: 'Cannot change status of an order with payment_failed status' });
        }

        // If the order is being cancelled, update the stock
        if (status === 'cancelled' && order.status !== 'cancelled') {
            for (const item of order.products) {
                const product = await Product.findById(item.productId);
                
                if (product) {
                    const sizeIndex = product.sizes.findIndex(size => size.size.toString() === item.size.toString());
                    if (sizeIndex !== -1) {
                        product.sizes[sizeIndex].stock += item.quantity; // Rebuild stock
                    } else {
                        return res.status(400).json({ success: false, message: `Size ${item.size} not found for product` });
                    }
                    await product.save();
                }
            }
        }

        // Update the order status
        order.status = status;
        
        // If the order status is now 'delivered', push userId to the product's purchasedByUserIds field
        if (status === 'delivered') {
            const userId = order.userId;
            for (const item of order.products) {
                const product = await Product.findById(item.productId);
                if (product) {
                    // Add userId to the purchasedByUserIds array if not already present
                    if (!product.purchasedByUserIds.includes(userId)) {
                        product.purchasedByUserIds.push(userId);
                        await product.save();
                    }
                }
            }
        }

        await order.save();
        
        if (order.status === 'returned') {
            const userId = order.userId;
            for (const item of order.products) {
                const product = await Product.findById(item.productId);
                if (product) {
                    const sizeIndex = product.sizes.findIndex(size => size.size.toString() === item.size.toString());
                    if (sizeIndex !== -1) {
                        product.sizes[sizeIndex].stock += item.quantity; // Rebuild stock
                    } else {
                        return res.status(400).json({ success: false, message: `Size ${item.size} not found for product` });
                    }
                    await product.save();
                }
            }
        }
        
        // Create a transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail', // Use your email service
            auth: {
                user: 'lijons13@gmail.com', // Your email
                pass: process.env.nodemailerPass,   // Your email password or an app-specific password
            },
        });

        // Send mail function
        const sendEmail = async (to, subject, text) => {
            const mailOptions = {
                from: 'lijons12@gmail.com', // Sender address
                to: to,                       // List of recipients
                subject: subject,             // Subject line
                text: text,                   // Plain text body
            };
          
            try {
                const info = await transporter.sendMail(mailOptions);
                console.log('Email sent:', info.response);
            } catch (error) {
                console.error('Error sending email:', error);
            }
        };

        if (order.status === 'returned') {
            const userId = order.userId;
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            const email = user.email;
            const subject = 'Your order returned successfully and payment credit to your wallet in future days';
            sendEmail(email, 'Order returned Successfully', subject);
        }
        if(order.status==='rejected_return'){
          const userId=order.userId;
          const user=await User.findById(userId);
          if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
          }
          const email=user.email;
          const subject = 'Your order return application rejected because irrelent reason ';
            sendEmail(email, 'Order returned Failed', subject);
          
        }
        if (order.status === 'refunded') {
          const userId = order.userId;
          const user = await User.findById(userId);
          if (!user) {
              return res.status(404).json({ success: false, message: 'User not found' });
          }
          
          let walletId = user.walletId; 
          let wallet;
          const refundAmount = order.totalPrice;
      
          if (walletId) {
              wallet = await Wallet.findById(walletId);
          }
      
          if (!wallet) {
              wallet = new Wallet({
                  userId: userId,
                  balance: 0
              });
              await wallet.save();
              user.walletId = wallet._id;
              await user.save();
          }
      
          // Update the wallet balance
          wallet.balance += refundAmount;
          
          // Add a transaction entry
          wallet.transactions.push({
              amount: refundAmount,
              type: 'credit',
              description: `Refund for Order #${order._id}`,
              date: new Date()
          });
      
          await wallet.save();
      
          // Send an email notification
          const email = user.email;
          await sendEmail(email, 'Amount Refunded Successfully', 
          `The refunded amount of $${refundAmount} has been credited to your wallet. Enjoy!`);
      
          // return res.status(200).json({ success: true, message: 'Refund processed successfully' });
      }
      
        
        res.status(200).redirect(`/admin/orders/${orderId}`); // Redirect back to orders page
    } catch (error) {
        console.error('Error updating order:', error); // Log the error for debugging
        res.status(500).json({ success: false, message: error.message });
    }
};


const getOrderDetailedPage=async(req,res)=>{
  try {
    const orderId=req.params.orderId;
    const order=await Order.findById(orderId).populate('products.productId')
    console.log(order,orderId)
    if(!order){
      return res.status(400).json({success:false,message:'Order not found'})
    }

    res.render('adminorders/orderDetailedPage',{order:order})
  } catch (error) {
    console.log('error order detailed page',error.message);
    res.status(400).json({success:false,message:error.message})
  }
}

// inventory****************************************

const getInventory=async (req, res) => {
    try {
        // Fetch all products
        const products = await Product.find({}, 'product sizes'); // Only fetch product name and sizes
  
        // Render the admin inventory page with the product data
        res.render('admininventory/inventory', { products });
    } catch (error) {
        console.error("Error fetching inventory:", error);
        res.status(500).send("Error fetching inventory");
    }
  }
  const postInventoryUpdate = async (req, res) => {
    try {
        const { productId, size, changeInStock } = req.body;

        // Find the product
        const product = await Product.findOne({ _id: productId });
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Find the size object
        const sizeObj = product.sizes.find(s => s.size === Number(size));
        if (!sizeObj) {
            return res.status(404).json({ success: false, message: 'Size not found' });
        }

        // Update stock
        sizeObj.stock += Number(changeInStock); // Increase or decrease stock

        // Save changes
        await product.save();

        res.redirect('/admin/inventory'); // Redirect back to inventory page
    } catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({ success: false, message: 'Failed to update stock', error: error.message });
    }
};

module.exports={
    getProduct,
    getViewProduct,
    getAddProduct,
    postAddProduct,
    postUnlist,
    postList,
    getProductEdit,
    patchProductEdit,
    getCustomers,
    postCustomerBlock,
    postCustomerUnblock,
    getCategory,
    getCategoryUpdate,
    patchCategoryUpdate,
    // deleteCategoryDelete,
    postCategoryBlock,
    postCategoryUnblock,
    getAddCategory,
    postAddCategory,
    getOrders,
    getEditOrder,
    postEditOrder,
    getOrderDetailedPage,
    getInventory,
    postInventoryUpdate


}