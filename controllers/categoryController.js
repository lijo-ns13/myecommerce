const express=require('express');

const Category=require('../models/categorySchema')

const getCategory=async(req,res)=>{
    const categories=await Category.find();

    res.render('category',{categories:categories})
};
const getUpdateCategory=async(req,res)=>{
    const id=req.params.id;
    const category=await Category.findById(id);
    res.render('update-category',{category})
};
const patchUpdateCategory=async(req,res)=>{
    const categoryId=req.params.id;
    const category=await Category.findByIdAndUpdate(categoryId,req.body,{new:true})
    if(!category){
        return res.status(404).send({message:'Category not found'})
    }
    res.status(200).json({success:true,message:'Category updated successfully',category:category})
};
const deleteCategory=async(req,res)=>{
    try{
        const categoryId=req.params.id;
    const category=await Category.findByIdAndDelete(categoryId);
    if(!category){
        return res.status(404).render('category/error',{success:false,message:'category not found'})
    }
    res.status(200).render('category/success',{success:true,message:'successfully deleted'})
    }catch(error){
        res.status(500).render('category/error',{success:false,message:error.message})
    }
};
const getaddcategory=(req,res)=>{
    res.render('add-category')
}
const postaddCategory=async(req,res)=>{
    try{
        const {name,description}=req.body;
        if(!name || !description){
            return res.status(400).json({success:false,message:'category and description are required'})
        }
        const categoryExist=await Category.findOne({name}) 
        if(categoryExist){
            return res.status(400).json({success:false,message:'category already exist'})
        }
        const newCategory = new Category(req.body);
        await newCategory.save();
        res.status(200).json({ success: true, message: 'Category added successfully' });
    }catch(error){
        res.status(400).json({success:false,message:error.message})
    }
}




module.exports={
    getCategory,
    getUpdateCategory,
    patchUpdateCategory,
    deleteCategory,
    getaddcategory,
    postaddCategory
}