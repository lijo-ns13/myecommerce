const express = require('express');
const router = express.Router();
const Coupon = require('../models/couponSchema');

router.post('/validate-coupon', async (req, res) => {
  const { couponCode, purchaseAmount } = req.body; // Include purchaseAmount in request

  try {
    // Check if the coupon exists in the database and is not deleted
    const coupon = await Coupon.findOne({ couponCode: couponCode, isDeleted: false });
    if (coupon) {
      // Check if the coupon is within the valid date range
      const now = new Date();
      if (now < coupon.startDate || now > coupon.endDate) {
        return res.json({ valid: false, message: 'Coupon is not active.' });
      }

      // Check if the purchase amount meets the minimum requirement
      if (purchaseAmount < coupon.minPurchaseAmount) {
        return res.json({
          valid: false,
          message: `Minimum purchase amount is $${coupon.minPurchaseAmount}.`,
        });
      }

      // Check usage limit
      if (coupon.usageLimit > 0) {
        // You would typically track how many times the coupon has been used in your application
        // This example assumes you have a way to track usage (not shown here)
        // For example, you might have a field in the coupon schema to track `usageCount`
        // If the usage limit has been reached, respond accordingly.
        const usageCount = 0; // Replace with actual usage count from your database
        if (usageCount >= coupon.usageLimit) {
          return res.json({ valid: false, message: 'Coupon usage limit reached.' });
        }
      }

      // If valid, return the discount details
      return res.json({
        valid: true,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscount: coupon.maxDiscount,
      });
    } else {
      // Coupon does not exist
      return res.json({ valid: false, message: 'Coupon does not exist.' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/validate-coupon', async (req, res) => {
  const { coupon } = req.body;

  try {
    // Find the coupon in the database
    const foundCoupon = await Coupon.findOne({ couponCode: coupon });

    // Check if the coupon exists and is valid
    if (!foundCoupon) {
      return res.json({ success: false, message: 'Coupon not found.' });
    }

    // Check if the coupon is active based on dates and usage limits
    const currentDate = new Date();
    if (
      foundCoupon.isDeleted ||
      foundCoupon.startDate > currentDate ||
      foundCoupon.endDate < currentDate
    ) {
      return res.json({ success: false, message: 'Coupon is not valid.' });
    }

    // Check if the coupon usage limit is exceeded (if applicable)
    if (foundCoupon.usageLimit > 0 && foundCoupon.usageLimit <= foundCoupon.usageCount) {
      return res.json({ success: false, message: 'Coupon usage limit exceeded.' });
    }

    // Coupon is valid
    return res.json({
      success: true,
      message: 'Coupon is valid!',
      discountType: foundCoupon.discountType,
      discountValue: foundCoupon.discountValue,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});
module.exports = router;
