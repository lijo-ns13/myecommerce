const express = require('express');

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const methodOverride = require('method-override');
const Product = require('../../models/productSchema'); // Adjust the path to your Product model
const { jwtAuth, adminProtected } = require('../../middlewares/auth');
const adminController = require('../../controllers/admin/admin.product.controller');
const router = express.Router();
router.use(express.urlencoded({ extended: true })); // To parse form data
router.use(methodOverride('_method'));

const uploadsDir = path.join(__dirname, '../uploads');

router.use(jwtAuth, adminProtected);

router.get('/', adminController.getProduct);
router.get('/viewproducts', adminController.getViewProduct);
router.get('/add-product', adminController.getAddProduct);
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
router.post('/add-product', upload.array('productImages', 5), adminController.postAddProduct);

// Helper function to generate a unique filename
const generateUniqueFilename = () => {
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
};
router.post('/unlist-product/:id', adminController.postUnlist);
router.post('/list-product/:id', adminController.postList);

router.get('/edit/:id', adminController.getProductEdit);
router.patch(
  '/edit-product/:id',
  upload.array('productImages', 5),
  adminController.patchProductEdit
);

// delete image
router.delete('/delete-image/:productId/:imageId', async (req, res) => {
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
});
module.exports = router;
