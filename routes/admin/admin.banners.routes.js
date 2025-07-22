const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const { jwtAuth, adminProtected } = require('../../middlewares/auth');

const multer = require('multer');
const uploadsDir = path.join(__dirname, '../../uploads');
const upload = multer({ dest: 'public/uploads/' });
const adminBannerController = require('../../controllers/admin/admin.banners.controller');
const router = express.Router();

router.use(express.urlencoded({ extended: true }));
router.use(methodOverride('_method'));
router.use(jwtAuth, adminProtected);

router.get('/', adminBannerController.getBanners);
router.post('/add-banner', upload.single('image'), adminBannerController.addBanner);
router.post('/delete/:bannerId', adminBannerController.deleteBanner);

module.exports = router;
