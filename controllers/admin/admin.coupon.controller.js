const Coupon = require('../../models/couponSchema');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const messages = require('../../constants/message');

const getCoupons = async (req, res) => {
  try {
    // Get page and limit from query params, default to page 1, limit 10
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1;
    const skip = (page - 1) * limit;

    // Get total count for pagination info
    const totalCoupons = await Coupon.countDocuments({});
    const totalPages = Math.ceil(totalCoupons / limit);

    // Fetch paginated data
    const coupons = await Coupon.find({}).skip(skip).limit(limit).sort({ createdAt: -1 }); // Optional: sort by created date

    res.render('admincoupon/coupon', {
      coupons: coupons,
      currentPath: '/coupon',
      layout: 'layouts/adminLayout',
      currentPage: page,
      totalPages: totalPages,
      limit: limit,
    });
  } catch (error) {
    res.status(httpStatusCodes.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

const getEditCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Coupon not found' });
    }
    res.render('admincoupon/editcoupon', {
      coupon: coupon,
      currentPath: '/coupon',
      layout: 'layouts/adminLayout',
    });
  } catch (error) {
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
const editCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const {
      couponCode,
      discountType,
      discountValue,
      startDate,
      endDate,
      minPurchaseAmount,
      usageLimit,
    } = req.body;

    // Validate required fields
    if (
      !couponCode ||
      !discountType ||
      !discountValue ||
      !startDate ||
      !endDate ||
      !minPurchaseAmount ||
      !usageLimit
    ) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.REQUIRED_FIELDS });
    }

    // Validate coupon code format
    const couponCodeRegex = /^[A-Z0-9]{6,12}(-[A-Z0-9]{6,12})?$/;
    if (!couponCodeRegex.test(couponCode)) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: messages.COUPON.INVALID_CODE,
      });
    }

    // Check for existing coupon code excluding the current one
    const existingCoupon = await Coupon.findOne({ couponCode, _id: { $ne: couponId } });
    if (existingCoupon) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.CODE_EXISTS });
    }

    // Validate numeric values
    if (isNaN(discountValue) || discountValue < 0) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: messages.COUPON.INVALID_DISCOUNT,
      });
    }
    if (discountValue > 60) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.DISCOUNT_TOO_HIGH });
    }
    if (isNaN(minPurchaseAmount) || minPurchaseAmount < 400) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.INVALID_MIN_PURCHASE });
    }
    if (usageLimit < 0) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.INVALID_USAGE_LIMIT });
    }

    // Validate discount type (only percentage allowed)
    const validDiscountTypes = ['percentage'];
    if (!validDiscountTypes.includes(discountType)) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.INVALID_DISCOUNT_TYPE });
    }

    // Parse and validate start and end dates
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.INVALID_DATE });
    }

    // Ensure that endDate is in the future
    const now = new Date();
    if (parsedEndDate <= now) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.END_DATE_PAST });
    }

    // Ensure that endDate is after startDate
    if (parsedEndDate <= parsedStartDate) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.END_DATE_BEFORE_START });
    }

    // Update the coupon
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      {
        couponCode,
        discountType,
        discountValue,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        minPurchaseAmount,
        usageLimit,
      },
      { new: true }
    );

    // Respond with success message
    res
      .status(httpStatusCodes.OK)
      .json({ success: true, message: messages.COUPON.UPDATE_SUCCESS, coupon: updatedCoupon });
  } catch (error) {
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
const getAddCoupon = async (_req, res) => {
  try {
    res.render('admincoupon/addcoupon', { currentPath: '/coupon', layout: 'layouts/adminLayout' });
  } catch (error) {
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
const addCoupon = async (req, res) => {
  try {
    const {
      couponCode,
      discountType,
      discountValue,
      startDate,
      endDate,
      minPurchaseAmount,
      usageLimit,
    } = req.body;
    console.log('reqy', req.body);
    if (
      !couponCode ||
      !discountType ||
      !discountValue ||
      !startDate ||
      !endDate ||
      !minPurchaseAmount ||
      !usageLimit
    ) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.REQUIRED_FIELDS });
    }
    const couponCodeRegex = /^[A-Z0-9]{6,12}(-[A-Z0-9]{6,12})?$/;
    if (!couponCodeRegex.test(couponCode)) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.INVALID_CODE_SIMPLE });
    }
    const coupon = await Coupon.findOne({ couponCode });
    if (coupon) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.CODE_EXISTS });
    }
    if (isNaN(discountValue) || discountValue < 0) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: messages.COUPON.INVALID_DISCOUNT,
      });
    }
    if (discountValue > 60) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.DISCOUNT_TOO_HIGH });
    }
    if (isNaN(minPurchaseAmount) || minPurchaseAmount < 400) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.INVALID_MIN_PURCHASE });
    }

    if (usageLimit < 0) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.INVALID_USAGE_LIMIT });
    }
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    // Check if the start date and end date are valid
    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.INVALID_DATE });
    }

    // Ensure that endDate is in the future
    const now = new Date();
    if (parsedEndDate <= now) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.END_DATE_PAST });
    }

    // Ensure that endDate is after startDate or equal to today
    if (parsedEndDate < parsedStartDate) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.END_DATE_BEFORE_START });
    }
    const validDiscountTypes = ['percentage'];
    if (!validDiscountTypes.includes(discountType)) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COUPON.INVALID_DATE });
    }

    const newCoupon = new Coupon({
      couponCode: couponCode,
      discountType: discountType,
      discountValue: discountValue,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      minPurchaseAmount: minPurchaseAmount,
      usageLimit: usageLimit,
    });
    await newCoupon.save();
    res.status(httpStatusCodes.OK).json({ success: true, message: messages.COUPON.ADD_SUCCESS });
  } catch (error) {
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: messages.COUPON.NOT_FOUND });
    }

    await Coupon.findByIdAndDelete(couponId);

    res.status(httpStatusCodes.OK).json({ success: true, message: messages.COUPON.DELETE_SUCCESS });
  } catch (error) {
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: messages.ERROR.SERVER_ERROR });
  }
};
module.exports = {
  getCoupons,
  addCoupon,
  getAddCoupon,
  editCoupon,
  getEditCoupon,
  deleteCoupon,
};
