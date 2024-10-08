const express = require('express');

const User = require('../models/userSchema');
const nodemailer = require('nodemailer');
const bcrypt=require('bcrypt')

const getProfile=async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).populate('address').select('+referralCode');

        res.render('profile/userprofile', { user });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
}
const getEditProfile=async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);
        res.render('profile/edit', { user });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
}
const getVerifyOtp=(req, res) => {
    res.render('profile/otp-verification');
}
const postEditProfile=async (req, res) => {
    console.log('clicked');
    try {
        const userId = req.user._id; // Assuming req.user is set by authentication middleware
        const { name, email } = req.body;

        // Input validation
        if (!name || !email) {
            return res.status(400).json({ success: false, message: 'Please fill in all fields' });
        }

        if (name.length < 4) {
            return res.status(400).json({ success: false, message: 'Name should be at least 4 characters long' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email address' });
        }

        const validNameRegex = /^[A-Za-z\s'-]{2,50}$/;
        if (!validNameRegex.test(name)) {
            return res.status(400).json({ success: false, message: 'Invalid name format' });
        }
        
        const user = await User.findById(userId).select('+password otp otpExpires email');
        console.log('user', user);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        console.log(user.email, typeof(user.email), "useremail");
        console.log(typeof(email), email, 'email');

        if (email === user.email) {
            // If email hasn't changed, just update the name
            user.name = name;
            await user.save();
            return res.status(200).json({ success: true, message: 'Profile updated successfully' });
        } else {
            const checkExistEmail=await User.findOne({email:email});
        if(checkExistEmail){
            return res.status(400).json({success:false,message:'Email Already exists'})
        }
            // If email has changed, generate and send OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit OTP
            const otpExpires = Date.now() + 10 * 60 * 1000; // Set OTP expiration time (10 minutes)

            // Update the user with the new email and OTP details
            user.newName=name;
            user.newEmail=email;
            user.otp = otp;
            user.otpExpires = otpExpires;
            await user.save();

            // Send OTP via email (adjust your email sending code as necessary)
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'lijons13@gmail.com',
                    pass: 'cbyb zggu etpz yhsu'
                }
            });

            const mailOptions = {
                from: 'lijons13@gmail.com',
                to: email,
                subject: 'Email Verification OTP',
                text: `Your OTP for email verification is: ${otp}. It will expire in 10 minutes.`
            };

            try {
                await transporter.sendMail(mailOptions);
                return res.status(200).json({ success: true, requiresOtp: true, message: 'OTP sent to your email. Please verify.' });
            } catch (error) {
                console.error('Error sending OTP email:', error);
                return res.status(500).json({ success: false, message: 'Failed to send OTP email' });
            }
        }
    } catch (err) {
        
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
}
const postVerifyOtp=async (req, res) => {
    try {
        const { otp } = req.body;
        const user = await User.findById(req.user._id).select('+newEmail +newName +otp +otpExpires');
        if(!user){
            return res.status(404).json({ success: false, message: 'User not found'})
        }
        if (otp!==user.otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        // Update email after successful verification
        
        user.name=user.newName;
        user.email=user.newEmail// Set to new email (this can be a variable if you store the new email temporarily)
        user.otp = undefined; // Clear OTP after use
        user.otpExpires = undefined; // Clear expiration after use
        user.newEmail=undefined;
        user.newName=undefined;
        await user.save();

        res.status(200).redirect('/user/profile'); // Redirect to profile page
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
}
const getChangePassword=async(req,res)=>{
    try{
        res.render('profile/change-password')
    }catch(error){
        console.error(error)
        res.status(400).json({success:false,message:error.message})
    }
}
const postChangePassword=async(req,res)=>{
    try {
        const {password,newPassword,confirmPassword}=req.body;
        if(!password || !newPassword || !confirmPassword){
            return res.status(400).json({success:false,message:'provide all fields'})
        }
        const user=await User.findById(req.user._id).select('+password');
        if(!user){
            return res.status(400).json({success:false,message:'user not found'})
        }
        if (!(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ success: false, message: 'Current password does not match' });
        }
        if(newPassword!==confirmPassword){
            return res.status(400).json({success:false,message:'New password and Confirm Password not matching'})
        }
        user.password=newPassword;
        await user.save();
        res.status(200).json({success:true,message:'Password changed successfuly'})
        
        
    } catch (error) {
        console.log(error)
        res.status(400).json({success:false,message:error.message})
    }
}

module.exports={
    getProfile,
    getEditProfile,
    getVerifyOtp,
    postEditProfile,
    postVerifyOtp,
    getChangePassword,
    postChangePassword
    }