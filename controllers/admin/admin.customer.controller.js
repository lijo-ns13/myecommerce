// controllers/customerController.js
const User = require('../../models/userSchema');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const messages = require('../../constants/message');

const getCustomers = async (req, res) => {
  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 8;

    const query = {
      role: 'user',
      ...(search
        ? {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } },
            ],
          }
        : {}),
    };

    const totalCustomers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalCustomers / limit);

    const customers = await User.find(query)
      .select('name email isBlocked createdAt') // Explicitly select fields
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(); // Convert to plain JavaScript object for performance

    if (req.xhr || req.query.ajax) {
      return res.render('partials/customerList', { customers }, { layout: false });
    }

    res.render('customers', {
      customers,
      currentPage: page,
      totalPages,
      searchQuery: search,
      currentPath: '/admin/customers',
      layout: 'layouts/adminLayout',
    });
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: messages.CUSTOMER.CUSTOMERS_FETCH_ERROR,
    });
  }
};

const postCustomerBlock = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).select('+isBlocked');
    if (!user) {
      return res.status(httpStatusCodes.NOT_FOUND).json({
        success: false,
        message: messages.CUSTOMER.USER_NOT_FOUND,
      });
    }

    if (user.isBlocked) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'User is already blocked',
      });
    }

    user.isBlocked = true;
    await user.save();

    res.json({
      success: true,
      message: 'User blocked successfully',
      userId: user._id,
      isBlocked: user.isBlocked,
    });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};

const postCustomerUnblock = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).select('+isBlocked');
    if (!user) {
      return res.status(httpStatusCodes.NOT_FOUND).json({
        success: false,
        message: messages.CUSTOMER.USER_NOT_FOUND,
      });
    }

    if (!user.isBlocked) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'User is already unblocked',
      });
    }

    user.isBlocked = false;
    await user.save();

    res.json({
      success: true,
      message: 'User unblocked successfully',
      userId: user._id,
      isBlocked: user.isBlocked,
    });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};

module.exports = {
  getCustomers,
  postCustomerBlock,
  postCustomerUnblock,
};
