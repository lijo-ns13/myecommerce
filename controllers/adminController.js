const express=require('express');
const userModel=require('../models/userSchema')

const JWT=require('jsonwebtoken');
const bcrypt=require('bcrypt');
const dotenv=require('dotenv').config();

const getDashboard=(req,res)=>{
    res.render('dashboard')
}

module.exports={
    getDashboard
}