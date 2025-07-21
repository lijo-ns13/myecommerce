
const express=require('express');
const path = require('path');
const methodOverride=require('method-override')
const {jwtAuth,adminProtected,userProtected}=require('../middlewares/auth');
const router=express.Router();
const Banner=require('../models/bannerSchema')
router.use(express.urlencoded({ extended: true })); // To parse form data
router.use(methodOverride('_method')); 
router.use(jwtAuth,adminProtected)

router.get('/banners', async (req, res) => {
  try {
      const banners = await Banner.find({});
      res.render('admin/banner', { banners });
  } catch (error) {
      console.log('Error fetching banners:', error.message);
      res.status(500).send('Server Error');
  }
});

// Add banner
router.post('/add-banner', upload.single('image'), async (req, res) => {
  try {
      const { bannerName, description } = req.body;
      const image = req.file;

      if (!image) {
          return res.status(400).json({ success: false, message: 'Image is required' });
      }

      const banner = new Banner({
        bannerName,
        description,
        image: path.join('uploads', image.filename).replace(/\\/g, '/'), // Normalize path
    });
    

      await banner.save();
      res.status(200).json({ success: true, message: 'Banner created successfully' });
  } catch (error) {
      console.log('Error on adding banner', error.message);
      res.status(400).json({ success: false, message: error.message });
  }
});

// Delete banner
router.post('/banners/delete/:bannerId', async (req, res) => {
  try {
      const bannerId = req.params.bannerId;
      const banner = await Banner.findById(bannerId);
      
      if (!banner) {
          return res.status(404).json({ success: false, message: 'Banner not found' });
      }

      await Banner.findByIdAndDelete(bannerId);
      res.status(200).json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
      console.log('Error on deleting banner', error.message);
      res.status(400).json({ success: false, message: error.message });
  }
});


module.exports=router;