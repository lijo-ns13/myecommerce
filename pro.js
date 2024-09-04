const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const Product = require('../models/productSchema'); // Adjust the path to your Product model
const Category=require('../models/categorySchema')
const router = express.Router();
const {jwtAuth,adminProtected}=require('../middlewares/auth');
// Define the upload directory
const uploadsDir = path.join(__dirname, '../uploads');
router.use(jwtAuth,adminProtected);

router.get('/',async(req,res)=>{
    const products=await Product.find({});
    res.json(products);
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

// POST route to add a product
router.post('/add-product', upload.array('productImages', 5), async (req, res) => {
  try {
    const { product, brand, description, price, size, category, croppedImages } = req.body;
    const sizes = size.split(',').map(Number);

    // Process uploaded files (regular images)
    const images = req.files.map(file => ({
      id: file.filename,
      secured_url: `/uploads/${file.filename}`,
    }));

    // Process cropped images if provided
    if (croppedImages) {
      const croppedImagesArray = JSON.parse(croppedImages);

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

    // Create and save the product with images (both regular and cropped)
    const newProduct = new Product({
      product,
      brand,
      description,
      price: Number(price),
      size: sizes,
      category,
      images
    });

    await newProduct.save();
    res.status(200).json({ message: 'Product added successfully!' });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ message: 'Failed to add product', error: error.message });
  }
});

// Helper function to generate a unique filename
const generateUniqueFilename = () => {
  return `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
};

module.exports = router;