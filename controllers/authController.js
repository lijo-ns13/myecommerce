

const express=require('express');
const userModel=require('../models/userSchema')

const JWT=require('jsonwebtoken');
const bcrypt=require('bcrypt');
const dotenv=require('dotenv').config();
const nodemailer=require('nodemailer');
const mailHelper = require('../utils/emailHelpers');
const crypto=require('crypto')



let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465, // or use 587 for TLS (with secure: false)
    secure: true, // true for 465, false for 587
    service: 'Gmail',
    auth: {
        user: 'lijons13@gmail.com', // your Gmail address
        pass: 'cbyb zggu etpz yhsu'  // your generated app password
    }
});
let otp;
let otpExpirationTime;
let oremail;
let temperaluserData = {};
const getSignin=(req,res)=>{
    res.render('signin');
}


const postSignin=async(req,res)=>{
    try{
        const {email,password}=req.body;
        if(!email||!password){
            return res.status(400).json({success:false,message:"Please fill in all fields"});
        }
        const regex=/^(("[\w-\s]+")|([\w-]+(?:\.[\w-]+)*)|("[\w-\s]+")([\w-]+(?:\.[\w-]+)*))(@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$)|(@\[?((25[0-5]\.|2[0-4][0-9]\.|1[0-9]{2}\.|[0-9]{1,2}\.))((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){2}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\]?$)/i;
        let result = regex.test(email);
        if(!result){
            return res.status(400).json({success:false,message:"Invalid email"});
        }
        const user=await userModel.findOne({email}).select('+password +isBlocked');
      
        if(user.isBlocked){
            return res.status(400).json({success:false,message:'Your account temporary blocked'})
        }
        if (!user || !await bcrypt.compare(password,user.password)) {
            return res.status(400).json({ success: false, message: "User not found or password not matching" });
        }
     
        const token=JWT.sign({_id:user._id,email:user.email,role:user.role},process.env.JWT_SECRET,{expiresIn:'24h'})
        user.password=undefined;
        const cookieOptions={
            maxAge:24*60*60*1000,
            httpOnly:true
        };
        console.log("logged in")
        res.cookie("token",token,cookieOptions);
        
        console.log('login')
        res.json({success:true,message:'login successful',role:user.role})
        
        
    }catch(error){
        return res.status(400).json({success:false,message:'please provide valid credentials'})
    }
    
}

const getSignup=(req,res)=>{
    res.render('signup');
}

const postSignup=async (req, res) => {
 
    try {
        const { name, email, password, confirmPassword } = req.body;
        oremail = email;

        if (!name || !email || !password || !confirmPassword) {
            return res.status(400).json({ success: false, message: "Please fill in all fields" });
        }
        if(!name.length>=4){
            return res.status(400).json({success:false,message:"atleast 4 characters required for name"})
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(email)) {
            return res.status(400).json({ success: false, message: "Invalid email" });
        }

        const validUsername = /^[A-Za-z\s'-]{2,50}$/;
        if (!validUsername.test(name)) {
            return res.status(400).json({ success: false, message: "Invalid name" });
        }

        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Email already exists" });
        }
        // res.status(200).json({success:true})
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let referralCode = '';
        for (let i = 0; i < 6; i++) {
            referralCode += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        console.log(referralCode);

        temperaluserData = { name, email, password,referralCode };
        otp = Math.floor(1000 + Math.random() * 9000);
        console.log(otp)
        otpExpirationTime = Date.now() + 1 * 60 * 1000;
        const mailOptions = {
            to: email,
            subject: "OTP for registration",
            html: `<h3>OTP for account verification is</h3><h1 style='font-weight:bold;'>${otp}</h1>`
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) {
                console.log(error);
                return res.status(500).json({ success: false, message: "Failed to send OTP" });
            }
            // res.status(200).render('otp', { msg: '' });
            return res.status(200).json({success:true,message:"otp sent successfull"})
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Email already exists" });
        }
        res.status(500).json({ success: false, message: error.message });
    }
}

const getForgotpassword=(req,res)=>{
    res.render('pwd/forgot-password')
}
const postForgotpassword=async(req,res)=>{
    const {email}=req.body;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!regex.test(email)){
        return res.status(400).json({success:false,message:'Invalid email'})
    }

    const user=await userModel.findOne({email});
    if(!user){
        return res.status(400).json({success:false,message:'User not found'});
    }
    const forgotToken=user.getForgotPasswordToken();
    await user.save({validateBeforeSave:false})

    const myUrl = `${req.protocol}://${req.get('host')}/auth/password/reset/${forgotToken}`;

    let messageone=`copy this url ${myUrl}`;

    try{
        let transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465, // or use 587 for TLS (with secure: false)
            secure: true, // true for 465, false for 587
            service: 'Gmail',
            auth: {
                user: 'lijons13@gmail.com', // your Gmail address
                pass: 'cbyb zggu etpz yhsu'  // your generated app password
            }
        });
           const message={
            from: 'lijons13@gmail.com', // sender address
            to: user.email, // list of receivers
            subject: 'forget password setting', // Subject line
            text: messageone
          }
          await transporter.sendMail(message);
        res.status(200).json({success:true,message:'email send successful'})
    }catch(error){
        user.forgotPasswordToken=undefined;
        user.forgotPasswordExpiry=undefined;
        await user.save({validateBeforeSave:false})
        res.status(400).json({success:false,message:error.message})

    }

}

const getResetsuccess=(req,res)=>{
    res.render('pwd/reset-success')
}

const getPasswordreset=(req,res)=>{
    const token=req.params.token;
    res.render('pwd/reset-password',{token:token})
}
const postPasswordreset=async(req,res)=>{
    try{
        const token=req.params.token;
    const encryToken=crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
    console.log(encryToken)
    const user=await userModel.findOne({
        forgotPasswordToken:encryToken,forgotPasswordExpiry:{$gt:Date.now()}
    })
    

    console.log(user)
    if(!user){
        return res.status(400).json({success:false,message:'Invalid token or expired'});
    }
    if(req.body.password!==req.body.confirmPassword){
        return res.status(400).json({success:false,message:"password and confirm password not same"})
    }
    user.forgotPasswordExpiry=undefined;
    user.forgotPasswordToken=undefined;
    user.password=req.body.password;
    await user.save();
    res.status(200).json({success:true,message:'Password changed successfully'})
    }catch(error){
        res.status(400).json({success:false,message:error.message})
    }
}



const getOtp= (req, res) => {
    res.render('otp', { msg: '' });
}
const postResend=async (req, res) => {
    try {
        otp = Math.floor(1000 + Math.random() * 9000);
        console.log(otp)
        otpExpirationTime = Date.now() + 1 * 60 * 1000;
        const mailOptions = {
            to: oremail,
            subject: "The Resend OTP for registration",
            html: `<h3>OTP for account verification is</h3><h1 style='font-weight:bold;'>${otp}</h1>`
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) {
                console.log(error);
                return res.status(500).json({ success: false, message: "Failed to resend OTP" });
            }
            res.status(200).render('otp')
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failure' });
    }
}
const postVerify= async (req, res) => {
    const {otp:providedOtp}=req.body;
    console.log('otp',otp);
    console.log('provided',providedOtp)
    if (providedOtp == otp) {
        if (Date.now() > otpExpirationTime) {
            return res.status(400).json({success:false,message:'otp expired'});
        }

        const userInfo = new userModel(temperaluserData);
        await userInfo.save();
        
        res.status(200).json({ success: true, message: "You have been successfully registered" });
    } else {
        res.status(400).json({success:false,message:'otp is incorrect'});
    }
}
const getLogout=(req,res)=>{

    res.clearCookie('token'); // Assuming 'jwt' is the name of your JWT cookie

    // If using Passport sessions, log out and clear session
    res.redirect('/auth/signin')
}

module.exports={
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
    postForgotpassword

}