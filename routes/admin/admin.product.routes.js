const express = require('express');

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const methodOverride = require('method-override');
const { jwtAuth, adminProtected } = require('../../middlewares/auth');
const adminController = require('../../controllers/admin/admin.product.controller');
const router = express.Router();
router.use(express.urlencoded({ extended: true }));
router.use(methodOverride('_method'));

const uploadsDir = path.join(__dirname, '../uploads');
// Ensure the upload directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer setup for file uploads
const upload = multer({
  dest: 'public/uploads/',
  limits: {
    fieldSize: 25 * 1024 * 1024, // 25 MB for text fields like base64
    fileSize: 5 * 1024 * 1024, // 5 MB per uploaded file
  },
});

router.use(jwtAuth, adminProtected);

router.get('/', adminController.getProduct);
router.get('/viewproducts', adminController.getViewProduct);
router.get('/add-product', adminController.getAddProduct);
router.post('/add-product', upload.array('productImages', 5), adminController.postAddProduct);
router.post('/unlist-product/:id', adminController.postUnlist);
router.post('/list-product/:id', adminController.postList);
router.get('/edit/:id', adminController.getProductEdit);
router.patch(
  '/edit-product/:id',
  upload.array('productImages', 5),
  adminController.patchProductEdit
);
router.delete('/delete-image/:productId/:imageId', adminController.deleteProduct);

module.exports = router;
