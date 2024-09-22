const express=require('express');

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const methodOverride=require('method-override')
const Product = require('../models/productSchema'); // Adjust the path to your Product model
const Category=require('../models/categorySchema')
const userModel=require('../models/userSchema')
const Order=require('../models/orderSchema')
const {jwtAuth,adminProtected,userProtected}=require('../middlewares/auth');

const uploadsDir = path.join(__dirname, '../uploads');

const getProduct=async(req,res)=>{
    const products=await Product.find({});
    
    res.render('pro/products',{products:products})
}
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
  const upload = multer({ dest: 'uploads/' });
  
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
          secured_url: `/uploads/${file.filename}`,
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
            secured_url: `/uploads/${filename}.${fileExtension}`,
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
        const productId = req.params.id;
        const { product, brand, description, price, category, existingImages, croppedImages, sizes } = req.body;

        // Initialize images array
        let images = [];

        // Handle existing images
        if (existingImages) {
            try {
                images = JSON.parse(existingImages);
            } catch (error) {
                return res.status(400).json({ success: false, message: 'Invalid format for existing images' });
            }
        }

        // Handle new images upload
        if (req.files) {
            const newImages = req.files.map(file => ({
                id: file.filename,
                secured_url: `/uploads/${file.filename}`,
            }));
            images = [...images, ...newImages]; 
        }

        // Handle cropped images
        if (croppedImages) {
            const croppedImagesArray = JSON.parse(croppedImages);
            for (const imgData of croppedImagesArray) {
                const filename = generateUniqueFilename();
                const filePath = await saveBase64Image(imgData, filename);
                const fileExtension = path.extname(filePath).slice(1);
                images.push({
                    id: filename,
                    secured_url: `/uploads/${filename}.${fileExtension}`,
                });
            }
        }

        // Validate sizes
        if (sizes) {
            sizes = JSON.parse(sizes);
            sizes.forEach(size => {
                if (size.size <= 0 || size.stock < 0) {
                    return res.status(400).json({ success: false, message: 'Sizes must be greater than 0 and stock must be 0 or greater' });
                }
            });
        } else {
            return res.status(400).json({ success: false, message: 'Sizes are required' });
        }

        // Update the product in the database
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            {
                product,
                brand,
                description,
                price: Number(price),
                sizes,
                category,
                images,
            },
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.status(200).json({ success: true, message: 'Product updated successfully', product: updatedProduct });
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
const deleteCategoryDelete=async(req,res)=>{
    try{
        const categoryId=req.params.id;
    const category=await Category.findByIdAndDelete(categoryId);
    if(!category){
        return res.status(404).render('category/error',{success:false,message:'category not found'})
    }
    // res.status(200).render('category/success',{success:true,message:'successfully deleted'})
    res.status(200).json({success:true,message:'Deleted Successfully'})
    }catch (error) {
      console.error('Error:', error); // Log the full error
      res.status(500).json({ success: false, message: error.message });
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

const getOrders=async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate({
                path: 'userId', // Populate userId field
                select: 'name' // Select the name field
            })
            .populate({
                path: 'products.productId', // Populate productId field within products
                select: 'product' // Select the name field
            });
  
        res.render('adminorders/orders', { orders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
  }
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
        const { status } = req.body; // Assuming status is sent in the request body

        const order = await Order.findById(orderId).populate('products.productId'); // Populate product details

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
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
        await order.save();

        res.redirect('/admin/orders'); // Redirect back to orders page
    } catch (error) {
        console.error('Error updating order:', error); // Log the error for debugging
        res.status(500).json({ success: false, message: error.message });
    }
};

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
    deleteCategoryDelete,
    getAddCategory,
    postAddCategory,
    getOrders,
    getEditOrder,
    postEditOrder,
    getInventory,
    postInventoryUpdate


}