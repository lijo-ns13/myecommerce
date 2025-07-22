const path = require('path');
const Banner = require('../../models/bannerSchema');

const getBanners = async (_req, res) => {
  try {
    const banners = await Banner.find({});
    res.render('admin/banner', { banners });
  } catch (error) {
    console.log('Error fetching banners:', error.message);
    res.status(500).send('Server Error');
  }
};
const addBanner = async (req, res) => {
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
};
const deleteBanner = async (req, res) => {
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
};
module.exports = {
  getBanners,
  addBanner,
  deleteBanner,
};
