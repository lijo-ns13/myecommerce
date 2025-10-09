const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');
const messages = require('../../constants/message');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const sendEmail = require('../../utils/mailer'); // adjust path

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.NODEMAILER_USEREMAIL,
    pass: process.env.NODEMAILER_USERPASS,
  },
});
const getProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate('address').select('+referralCode');

    res.render('profile/userprofile', { user });
  } catch (err) {
    console.error(err);
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).send('Server Error');
  }
};
const getEditProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    res.render('profile/edit', { user });
  } catch (error) {
    console.error(error);
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).send('Server Error');
  }
};
const getVerifyOtp = (req, res) => {
  res.render('profile/otp-verification');
};
const postEditProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Please fill all fields',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // If email not changed, just update name
    if (email === user.email) {
      user.name = name;
      await user.save();
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        requiresOtp: false,
      });
    }

    // Email changed → generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000;

    user.newName = name;
    user.newEmail = email;
    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // Send OTP email
    const mailOptions = {
      from: process.env.NODEMAILER_USEREMAIL,
      to: email,
      subject: 'Verify Your New Email',
      html: `<h3>OTP for account verification:</h3>
             <h1 style="font-weight:bold;">${otp}</h1>`,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('OTP email sent successfully');
      return res.status(200).json({
        success: true,
        requiresOtp: true,
        message: 'OTP sent to your new email address.',
      });
    } catch (mailError) {
      console.error('Error sending OTP:', mailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email.',
      });
    }
  } catch (err) {
    console.error('Error in postEditProfile:', err);
    return res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

const postVerifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await User.findById(req.user._id).select('+newEmail +newName +otp +otpExpires');
    if (!user) {
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'User not found' });
    }
    if (otp !== user.otp || user.otpExpires < Date.now()) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Update email after successful verification

    user.name = user.newName;
    user.email = user.newEmail; // Set to new email (this can be a variable if you store the new email temporarily)
    user.otp = undefined; // Clear OTP after use
    user.otpExpires = undefined; // Clear expiration after use
    user.newEmail = undefined;
    user.newName = undefined;
    await user.save();

    res.status(httpStatusCodes.OK).redirect('/user/profile'); // Redirect to profile page
  } catch (err) {
    console.error(err);
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).send('Server Error');
  }
};
const getChangePassword = async (req, res) => {
  try {
    res.render('profile/change-password');
  } catch (error) {
    console.error(error);
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
const postChangePassword = async (req, res) => {
  try {
    const { password, newPassword, confirmPassword } = req.body;
    if (!password || !newPassword || !confirmPassword) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'provide all fields' });
    }
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'user not found' });
    }
    if (!user.password) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Your a google user so how password change' });
    }
    if (!(await bcrypt.compare(password, user.password))) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Current password does not match' });
    }
    if (newPassword !== confirmPassword) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'New password and Confirm Password not matching' });
    }
    user.password = newPassword;
    await user.save();
    res.status(httpStatusCodes.OK).json({ success: true, message: 'Password changed successfuly' });
  } catch (error) {
    console.log(error);
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
const getWallet = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    let wallet = await Wallet.findOne({ userId: user._id });

    // If wallet doesn't exist, create it
    if (!wallet) {
      wallet = await Wallet.create({
        userId: user._id,
        balance: 0,
        transactions: [],
      });
    }

    // Assign walletId if missing
    if (!user.walletId) {
      user.walletId = wallet._id;
      await user.save();
    }

    // Defensive check for transactions
    if (!Array.isArray(wallet.transactions)) {
      wallet.transactions = [];
    }

    // Pagination logic
    const page = parseInt(req.query.page) || 1; // default to page 1
    const limit = parseInt(req.query.limit) || 10; // default 10 transactions per page
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const totalTransactions = wallet.transactions.length;
    const paginatedTransactions = wallet.transactions
      .slice() // make a shallow copy
      .reverse() // newest first
      .slice(startIndex, endIndex);

    const totalPages = Math.ceil(totalTransactions / limit);

    // Render the wallet page
    res.render('profile/wallet', {
      wallet,
      transactions: paginatedTransactions,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the wallet.',
    });
  }
};

module.exports = {
  getProfile,
  getEditProfile,
  getVerifyOtp,
  postEditProfile,
  postVerifyOtp,
  getChangePassword,
  postChangePassword,
  getWallet,
};
