const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const uploadsDir = path.join(__dirname, '../../uploads');

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
    totalPages: totalPages,
  });
};
const getViewProduct = async (req, res) => {
  const products = await Product.find({});
  // res.json(products)
  res.render('viewproducts', { products: products });
};
const getAddProduct = async (req, res) => {
  try {
    const categories = await Category.find({});
    res.status(200).render('add-product', { categories: categories });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
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

const postAddProduct = async (req, res) => {
  try {
    const { product, brand, description, price, category, croppedImages } = req.body;

    // Initialize images array
    let images = [];

    // Process uploaded files (regular images)
    if (req.files) {
      images = req.files.map((file) => ({
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
    if (!product || !brand || !description || !price || !category || !croppedImages) {
      return res.status(400).json({ status: false, message: 'Please fill all fieldss' });
    }
    const productRegex = /^[a-zA-Z0-9 _'-]{2,100}$/;

    if (!productRegex.test(product)) {
      return res
        .status(400)
        .json({ success: false, message: 'Product name should only contain letters, numbers' });
    }
    if (product.length < 4) {
      return res.status(400).json({ success: false, message: 'Product name atleast 4 characters' });
    }
    const brandRegex = /^[a-zA-Z0-9][a-zA-Z0-9 &-]{1,48}[a-zA-Z0-9]$/;
    if (!brandRegex.test(brand)) {
      return res
        .status(400)
        .json({ success: false, message: 'Brand name should only contain letters' });
    }
    if (brand.length < 4) {
      return res.status(400).json({ success: false, message: 'Brand atleast have 4 characters' });
    }
    if (description.length < 8) {
      return res
        .status(400)
        .json({ success: false, message: 'Description atleat have 8 characters' });
    }
    if (Number(price) < 0) {
      return res.status(400).json({ success: false, message: 'Price should be greater than zero' });
    }
    const sizes = req.body.sizes.map((sizeObj) => ({
      size: Number(sizeObj.size),
      stock: Number(sizeObj.stock),
    }));
    if (!sizes || sizes.length == 0) {
      return res.status(400).json({ success: false, message: 'add atleast one size and stock' });
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
      finalPrice: price,
      sizes,
      category,
      images,
    });

    await newProduct.save();
    res.status(200).json({ success: true, message: 'Product added successfully!' });
    // res.status(200).render('pro/addproductsuccess')
  } catch (error) {
    console.error('Error adding product:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to add product', error: error.message });
  }
};

const generateUniqueFilename = () => {
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
};
const postUnlist = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findOneAndUpdate(
      { _id: productId },
      { isListed: false },
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    // res.status(200).render('pro/unlistproductsuccess')
    res.status(200).json({ success: true, message: 'unlisted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
const postList = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findOneAndUpdate(
      { _id: productId },
      { isListed: true },
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    // res.status(200).render('pro/listproductsuccess')
    res.status(200).json({ success: true, message: 'listed successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
const getProductEdit = async (req, res) => {
  try {
    const productId = req.params.id;
    const categories = await Category.find({});
    const product = await Product.findById(productId);
    res.render('pro/updateproduct', { product, categories });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};
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
    const productRegex = /^[a-zA-Z0-9 _'-]{2,100}$/;

    if (!productRegex.test(product)) {
      return res
        .status(400)
        .json({ success: false, message: 'Product name should only contain letters, numbers' });
    }
    if (product.length < 4) {
      return res.status(400).json({ success: false, message: 'Product name atleast 4 characters' });
    }
    const brandRegex = /^[a-zA-Z0-9][a-zA-Z0-9 &-]{1,48}[a-zA-Z0-9]$/;
    if (!brandRegex.test(brand)) {
      return res
        .status(400)
        .json({ success: false, message: 'Brand name should only contain letters' });
    }
    if (brand.length < 4) {
      return res.status(400).json({ success: false, message: 'Brand atleast have 4 characters' });
    }
    if (description.length < 8) {
      return res
        .status(400)
        .json({ success: false, message: 'Description atleat have 8 characters' });
    }
    if (Number(price) < 0) {
      return res.status(400).json({ success: false, message: 'Price should be greater than zero' });
    }
    // Validate sizes from the request body
    const sizes = req.body.sizes; // Ensure sizes is correctly assigned

    if (!Array.isArray(sizes)) {
      return res.status(400).json({ success: false, message: 'Sizes must be an array.' });
    }

    // Filter out any invalid or empty size entries, if necessary
    const filteredSizes = sizes.filter((sizeObj) => sizeObj.size && sizeObj.stock);

    // If all sizes have been removed, send an error
    if (filteredSizes.length === 0) {
      return res.status(400).json({ success: false, message: 'Add at least one size and stock' });
    }

    const sizesArray = filteredSizes.map((sizeObj) => {
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
    res
      .status(500)
      .json({ success: false, message: 'Failed to update product', error: error.message });
  }
};
const deleteProduct = async (req, res) => {
  const productId = req.params.productId;
  const imageId = req.params.imageId;

  try {
    // Remove the image with the specified ID from the specified product's images array
    await Product.updateOne(
      { _id: productId },
      { $pull: { images: { id: imageId } } } // Remove the image by its ID
    );

    res.status(200).send({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error deleting image' });
  }
};

module.exports = {
  getProduct,
  getViewProduct,
  getAddProduct,
  postAddProduct,
  postUnlist,
  postList,
  getProductEdit,
  patchProductEdit,
  deleteProduct,
};
