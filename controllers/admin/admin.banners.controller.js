const path = require('path');
const Banner = require('../../models/bannerSchema');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const messages = require('../../constants/message');
const getBanners = async (_req, res) => {
  try {
    const banners = await Banner.find({});
    res.render('admin/banner', { banners });
  } catch (error) {
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).send('Server Error');
  }
};
const addBanner = async (req, res) => {
  try {
    const { bannerName, description } = req.body;
    const image = req.file;

    if (!image) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.BANNER.IMAGE_REQUIRED });
    }

    const banner = new Banner({
      bannerName,
      description,
      image: path.join('uploads', image.filename).replace(/\\/g, '/'), // Normalize path
    });

    await banner.save();
    res
      .status(httpStatusCodes.CREATED)
      .json({ success: true, message: messages.BANNER.CREATE_SUCCESS });
  } catch (error) {
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
const deleteBanner = async (req, res) => {
  try {
    const bannerId = req.params.bannerId;
    const banner = await Banner.findById(bannerId);

    if (!banner) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.BANNER.NOT_FOUND });
    }

    await Banner.findByIdAndDelete(bannerId);
    res.status(httpStatusCodes.OK).json({ success: true, message: messages.BANNER.DELETE_SUCCESS });
  } catch (error) {
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
module.exports = {
  getBanners,
  addBanner,
  deleteBanner,
};
