const Coupon = require('../../models/couponSchema');
const getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({});
    res.render('admincoupon/coupon', { coupons: coupons, currentPath: '/coupon' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
const getEditCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(400).json({ success: false, message: 'Coupon not found' });
    }
    res.render('admincoupon/editcoupon', { coupon: coupon, currentPath: '/coupon' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'Please fill all fields' });
    }

    // Validate coupon code format
    const couponCodeRegex = /^[A-Z0-9]{6,12}(-[A-Z0-9]{6,12})?$/;
    if (!couponCodeRegex.test(couponCode)) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Invalid coupon code. Only uppercase letters and numbers allowed.',
        });
    }

    // Check for existing coupon code excluding the current one
    const existingCoupon = await Coupon.findOne({ couponCode, _id: { $ne: couponId } });
    if (existingCoupon) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }

    // Validate numeric values
    if (isNaN(discountValue) || discountValue < 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Discount value must be a valid number and cannot be negative',
        });
    }
    if (discountValue > 60) {
      return res
        .status(400)
        .json({ success: false, message: 'Discount percentage must be less than 60' });
    }
    if (isNaN(minPurchaseAmount) || minPurchaseAmount < 400) {
      return res
        .status(400)
        .json({ success: false, message: 'Minimum purchase amount cannot be less than 400' });
    }
    if (usageLimit < 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Usage limit should be greater than zero' });
    }

    // Validate discount type (only percentage allowed)
    const validDiscountTypes = ['percentage'];
    if (!validDiscountTypes.includes(discountType)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid discount type. Only "percentage" is allowed.' });
    }

    // Parse and validate start and end dates
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }

    // Ensure that endDate is in the future
    const now = new Date();
    if (parsedEndDate <= now) {
      return res.status(400).json({ success: false, message: 'End date must be in the future' });
    }

    // Ensure that endDate is after startDate
    if (parsedEndDate <= parsedStartDate) {
      return res.status(400).json({ success: false, message: 'End date must be after start date' });
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
      .status(200)
      .json({ success: true, message: 'Coupon updated successfully', coupon: updatedCoupon });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
const getAddCoupon = async (_req, res) => {
  try {
    res.render('admincoupon/addcoupon', { currentPath: '/coupon' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'Please fill all fieldss' });
    }
    const couponCodeRegex = /^[A-Z0-9]{6,12}(-[A-Z0-9]{6,12})?$/;
    if (!couponCodeRegex.test(couponCode)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid coupon code and only alpha cap and num' });
    }
    const coupon = await Coupon.findOne({ couponCode });
    if (coupon) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }
    if (isNaN(discountValue) || discountValue < 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Discount value must be a valid number and cannot be negative',
        });
    }
    if (discountValue > 60) {
      return res
        .status(400)
        .json({ success: false, message: 'Discount Percentage Must be less than 60' });
    }
    if (isNaN(minPurchaseAmount) || minPurchaseAmount < 400) {
      return res
        .status(400)
        .json({ success: false, message: 'Minimum purchase amount cannot be less than 400' });
    }

    if (usageLimit < 0) {
      return res.status(400).json({ success: false, message: 'the limit should be greter zero' });
    }
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    // Check if the start date and end date are valid
    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }

    // Ensure that endDate is in the future
    const now = new Date();
    if (parsedEndDate <= now) {
      return res.status(400).json({ success: false, message: 'End date must be in the future' });
    }

    // Ensure that endDate is after startDate or equal to today
    if (parsedEndDate < parsedStartDate) {
      return res.status(400).json({ success: false, message: 'End date must be after start date' });
    }
    const validDiscountTypes = ['percentage'];
    if (!validDiscountTypes.includes(discountType)) {
      return res.status(400).json({ success: false, message: 'Invalid discount type' });
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
    res.status(200).json({ success: true, message: 'coupon added successfuly' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    await Coupon.findByIdAndDelete(couponId);

    res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Error deleting coupon:', error);

    res.status(500).json({ success: false, message: 'Internal server error' });
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
