require('dotenv').config();
const userModel = require('../../models/userSchema');
const JWT = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const messages = require('../../constants/message');
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.NODEMAILER_USEREMAIL,
    pass: process.env.NODEMAILER_USERPASS,
  },
});

let otp;
let otpExpirationTime;
let oremail;
let temperaluserData = {};
const getSignin = (_req, res) => {
  res.render('signin');
};

const postSignin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.AUTH.FILL_ALL_FIELDS });
    }
    const regex =
      /^(("[\w-\s]+")|([\w-]+(?:\.[\w-]+)*)|("[\w-\s]+")([\w-]+(?:\.[\w-]+)*))(@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$)|(@\[?((25[0-5]\.|2[0-4][0-9]\.|1[0-9]{2}\.|[0-9]{1,2}\.))((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){2}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\]?$)/i;
    let result = regex.test(email);
    if (!result) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.AUTH.INVALID_EMAIL });
    }
    const user = await userModel.findOne({ email }).select('+password +isBlocked');

    if (user.isBlocked) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.AUTH.BLOCKED });
    }
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.AUTH.INVALID_CREDENTIALS });
    }

    const token = JWT.sign(
      { _id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    user.password = undefined;
    const cookieOptions = {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
    };
    console.log('logged in');
    res.cookie('token', token, cookieOptions);

    console.log('login');
    res.json({ success: true, message: messages.AUTH.LOGIN_SUCCESS, role: user.role });
  } catch (error) {
    return res
      .status(httpStatusCodes.BAD_REQUEST)
      .json({ success: false, message: messages.AUTH.LOGIN_FAIL });
  }
};

const getSignup = (_req, res) => {
  res.render('signup');
};

const postSignup = async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    oremail = email;

    if (!name || !email || !password || !confirmPassword) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.AUTH.FILL_ALL_FIELDS });
    }
    if (!name.length >= 4) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.AUTH.NAME_SHORT });
    }
    if (password !== confirmPassword) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.AUTH.PASSWORD_MISMATCH });
    }
    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!strongPasswordRegex.test(password)) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: messages.AUTH.WEAK_PASSWORD,
      });
    }
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email)) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.AUTH.INVALID_EMAIL });
    }

    const validUsername = /^[A-Za-z\s'-]{2,50}$/;
    if (!validUsername.test(name)) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.AUTH.INVALID_NAME });
    }

    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.AUTH.EMAIL_EXISTS });
    }
    // res.status(200).json({success:true})
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let referralCode = '';
    for (let i = 0; i < 6; i++) {
      referralCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    console.log(referralCode);

    temperaluserData = { name, email, password, referralCode };
    otp = Math.floor(1000 + Math.random() * 9000);
    console.log(otp);
    otpExpirationTime = Date.now() + 1 * 60 * 1000;
    const mailOptions = {
      from: process.env.NODEMAILER_USEREMAIL,
      to: email,
      subject: 'OTP for Registration',
      html: `<h3>OTP for account verification:</h3><h1 style="font-weight:bold;">${otp}</h1>`,
    };

    transporter
      .sendMail(mailOptions)
      .then((info) => {
        console.log('OTP email sent:', info.response);
        return res
          .status(httpStatusCodes.OK)
          .json({ success: true, message: messages.AUTH.OTP_SENT });
      })
      .catch((error) => {
        console.error('Error sending OTP:', error);
        return res
          .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
          .json({ success: false, message: messages.AUTH.OTP_FAILED });
      });
  } catch (error) {
    console.error('Signup error:', error);
    return res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: messages.AUTH.GENERAL_ERROR });
  }
};

const getForgotpassword = (_req, res) => {
  res.render('pwd/forgot-password');
};
const postForgotpassword = async (req, res) => {
  const { email } = req.body;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    return res
      .status(httpStatusCodes.BAD_REQUEST)
      .json({ success: false, message: messages.AUTH.INVALID_EMAIL });
  }

  const user = await userModel.findOne({ email });
  if (!user) {
    return res
      .status(httpStatusCodes.BAD_REQUEST)
      .json({ success: false, message: messages.COMMON.USER_NOT_FOUND });
  }
  const forgotToken = user.getForgotPasswordToken();
  await user.save({ validateBeforeSave: false });

  const myUrl = `${req.protocol}://${req.get('host')}/auth/password/reset/${forgotToken}`;

  let messageone = `copy this url ${myUrl}`;

  try {
    const message = {
      from: 'lijons13@gmail.com', // sender address
      to: user.email, // list of receivers
      subject: 'forget password setting', // Subject line
      text: messageone,
    };
    await transporter.sendMail(message);
    res.status(httpStatusCodes.OK).json({ success: true, message: 'email send successful' });
  } catch (error) {
    user.forgotPasswordToken = undefined;
    user.forgotPasswordExpiry = undefined;
    await user.save({ validateBeforeSave: false });
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};

const getResetsuccess = (_req, res) => {
  res.render('pwd/reset-success');
};

const getPasswordreset = (req, res) => {
  const token = req.params.token;
  res.render('pwd/reset-password', { token: token });
};
const postPasswordreset = async (req, res) => {
  try {
    const token = req.params.token;
    const encryToken = crypto.createHash('sha256').update(token).digest('hex');
    console.log(encryToken);
    const user = await userModel.findOne({
      forgotPasswordToken: encryToken,
      forgotPasswordExpiry: { $gt: Date.now() },
    });

    console.log(user);
    if (!user) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.AUTH.TOKEN_INVALID });
    }
    if (req.body.password !== req.body.confirmPassword) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.AUTH.PASSWORD_CONFIRM_FAIL });
    }
    user.forgotPasswordExpiry = undefined;
    user.forgotPasswordToken = undefined;
    user.password = req.body.password;
    await user.save();
    res.status(httpStatusCodes.OK).json({ success: true, message: messages.AUTH.PASSWORD_CHANGED });
  } catch (error) {
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};

const getOtp = (_req, res) => {
  res.render('otp', { msg: '' });
};
const postResend = async (req, res) => {
  try {
    otp = Math.floor(1000 + Math.random() * 9000);
    console.log(otp);
    otpExpirationTime = Date.now() + 1 * 60 * 1000;
    const mailOptions = {
      to: oremail,
      subject: 'The Resend OTP for registration',
      html: `<h3>OTP for account verification is</h3><h1 style='font-weight:bold;'>${otp}</h1>`,
    };

    transporter.sendMail(mailOptions, (error) => {
      if (error) {
        console.log(error);
        return res
          .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
          .json({ success: false, message: messages.AUTH.OTP_FAILED });
      }
      res.status(httpStatusCodes.OK).render('otp');
    });
  } catch (error) {
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failure' });
  }
};
const postVerify = async (req, res) => {
  const { otp: providedOtp } = req.body;
  console.log('otp', otp);
  console.log('provided', providedOtp);
  if (providedOtp == otp) {
    if (Date.now() > otpExpirationTime) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.AUTH.OTP_EXPIRED });
    }

    const userInfo = new userModel(temperaluserData);
    await userInfo.save();

    res.status(httpStatusCodes.OK).json({ success: true, message: messages.AUTH.REGISTER_SUCCESS });
  } else {
    res
      .status(httpStatusCodes.BAD_REQUEST)
      .json({ success: false, message: messages.AUTH.OTP_INCORRECT });
  }
};
const getLogout = (_req, res) => {
  res.clearCookie('token'); // Assuming 'jwt' is the name of your JWT cookie

  // If using Passport sessions, log out and clear session
  res.redirect('/auth/signin');
};

module.exports = {
  getSignin,
  postSignin,
  getSignup,
  postSignup,
  getLogout,
  postVerify,
  postResend,
  getOtp,
  getPasswordreset,
  postPasswordreset,
  getResetsuccess,
  getForgotpassword,
  postForgotpassword,
};
