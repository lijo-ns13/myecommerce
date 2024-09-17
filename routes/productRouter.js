const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const methodOverride=require('method-override')
const Product = require('../models/productSchema'); // Adjust the path to your Product model
const Category=require('../models/categorySchema')
const router = express.Router();
const {jwtAuth,adminProtected}=require('../middlewares/auth');
// Define the upload directory
router.use(express.urlencoded({ extended: true })); // To parse form data
router.use(methodOverride('_method')); 

const uploadsDir = path.join(__dirname, '../uploads');
router.use(jwtAuth,adminProtected);

router.get('/',async(req,res)=>{
    const products=await Product.find({});
    
    res.render('pro/products',{products:products})
})
router.get('/viewproducts',async(req,res)=>{
  const products=await Product.find({});
  // res.json(products)
  res.render('viewproducts',{products:products})
})
router.get('/add-product',async(req,res)=>{
    try{
        const categories=await Category.find({});
        res.status(200).render('add-product',{categories:categories})
    }catch(error){

    }
})
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
router.post('/add-product', upload.array('productImages', 5), async (req, res) => {
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
      return res.status(400).json({ status:false,message: 'Please fill all fields' });
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
});

// Helper function to generate a unique filename
const generateUniqueFilename = () => {
  return `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
};
router.post('/unlist-product/:id',async(req,res)=>{
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
})
router.post('/list-product/:id',async(req,res)=>{
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
})

router.get('/edit/:id',async(req,res)=>{
  try {
    const productId=req.params.id;
    const categories=await Category.find({})
    const product = await Product.findById(productId);
    res.render('pro/updateproduct', { product,categories });
} catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
}
})
router.post('/edit/:id', upload.single('newImages'), async (req, res) => {
  try {
      const productId = req.params.id;
      const updateData = req.body;

      // Convert size string to an array of numbers
      if (updateData.size) {
          updateData.size = updateData.size.split(',').map(size => parseFloat(size.trim()));
      }

      // If there's an image uploaded, handle the new image
      if (req.file) {
          const imageUrl = `/uploads/${req.file.filename}`;
          updateData.images = [{ secured_url: imageUrl }];
      }

      // Update the product in the database
      const updatedProduct = await Product.findByIdAndUpdate(productId, updateData, { new: true });
      if (!updatedProduct) {
          return res.status(404).json({success:false, message: 'Product not found' });
      }

      res.status(200).json({ success: true, message: 'Product updated successfully', product: updatedProduct });
  } catch (error) {
      res.status(400).json({ success: false, message: error.message });
  }
});

// admin/products/edit/66d57f2a530693faed1f2e4c/
router.post('/edit/:product-id',(req,res)=>{
  res.json('success')
})
module.exports = router;
























