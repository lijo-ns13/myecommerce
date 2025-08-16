const Category = require('../../models/categorySchema');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const messages = require('../../constants/message');
const getCategory = async (req, res) => {
  const categories = await Category.find();

  res.render('category', { categories: categories, currentPath: '/category' });
};
const getCategoryUpdate = async (req, res) => {
  const id = req.params.id;
  const category = await Category.findById(id);
  res.render('update-category', { category, currentPath: '/category' });
};
const patchCategoryUpdate = async (req, res) => {
  const categoryId = req.params.id;
  const category = await Category.findByIdAndUpdate(categoryId, req.body, { new: true });
  if (!category) {
    return res.status(httpStatusCodes.NOT_FOUND).send({ message: messages.CATEGORY.NOT_FOUND });
  }
  res
    .status(httpStatusCodes.OK)
    .json({ success: true, message: messages.CATEGORY.UPDATE_SUCCESS, category: category });
};
// const deleteCategoryDelete=async(req,res)=>{
//     try{
//         const categoryId=req.params.id;
//     const category=await Category.findByIdAndDelete(categoryId);
//     if(!category){
//         return res.status(404).render('category/error',{success:false,message:'category not found'})
//     }
//     // res.status(200).render('category/success',{success:true,message:'successfully deleted'})
//     res.status(200).json({success:true,message:'Deleted Successfully'})
//     }catch (error) {
//       console.error('Error:', error); // Log the full error
//       res.status(500).json({ success: false, message: error.message });
//   }
// }
const postCategoryBlock = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const category = await Category.findById({ _id: categoryId });
    if (!category) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.CATEGORY.NOT_FOUND });
    }
    const upCategory = await Category.findByIdAndUpdate(
      categoryId,
      { isBlocked: true },
      { new: true }
    );
    if (!upCategory) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.CATEGORY.UPDATE_FAILED });
    }
    res
      .status(httpStatusCodes.OK)
      .json({ success: true, message: messages.CATEGORY.BLOCK_SUCCESS });
    // res.status(200).redirect('/admin/category')
  } catch (error) {
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
const postCategoryUnblock = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const category = await Category.findById({ _id: categoryId });
    if (!category) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.CATEGORY.NOT_FOUND });
    }
    const upCategory = await Category.findByIdAndUpdate(
      categoryId,
      { isBlocked: false },
      { new: true }
    );
    if (!upCategory) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.CATEGORY.UPDATE_FAILED });
    }
    res
      .status(httpStatusCodes.OK)
      .json({ success: true, message: messages.CATEGORY.UNBLOCK_SUCCESS });
    // res.status(200).redirect('/admin/category')
  } catch (error) {
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
const getAddCategory = (req, res) => {
  res.render('add-category', { currentPath: '/category' });
};
const postAddCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !description) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.CATEGORY.REQUIRED_FIELDS });
    }
    const categoryExist = await Category.findOne({ name });
    if (categoryExist) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.CATEGORY.ALREADY_EXISTS });
    }
    const newCategory = new Category(req.body);
    await newCategory.save();
    res
      .status(httpStatusCodes.CREATED)
      .json({ success: true, message: messages.CATEGORY.ADD_SUCCESS });
  } catch (error) {
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
module.exports = {
  getCategory,
  getCategoryUpdate,
  patchCategoryUpdate,
  postCategoryBlock,
  postCategoryUnblock,
  getAddCategory,
  postAddCategory,
};
