const Category = require('../../models/categorySchema');
const httpStatusCodes = require('../../constants/httpStatusCodes');
const messages = require('../../constants/message');
const getCategory = async (req, res) => {
  try {
    // Pagination defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Search
    const search = req.query.search || '';
    const query = search ? { name: { $regex: search, $options: 'i' } } : {};

    // Fetch categories with pagination
    const [categories, totalCategories] = await Promise.all([
      Category.find(query).skip(skip).limit(limit),
      Category.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCategories / limit);

    res.render('category', {
      categories,
      currentPath: '/category',
      layout: 'layouts/adminLayout',
      currentPage: page,
      totalPages,
      search,
      limit, // ✅ pass limit to EJS
    });
  } catch (error) {
    console.error(error);
    res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).send('Server Error');
  }
};

const getCategoryUpdate = async (req, res) => {
  const id = req.params.id;
  const category = await Category.findById(id);
  res.render('update-category', {
    category,
    currentPath: '/category',
    layout: 'layouts/adminLayout',
  });
};
const patchCategoryUpdate = async (req, res) => {
  const categoryId = req.params.id;
  const { name, description } = req.body;
  if (!name || !description) {
    return res
      .status(httpStatusCodes.BAD_REQUEST)
      .json({ success: false, message: messages.COMMON.ALL_FIELDS_REQUIRED });
  }
  if ((name.trim().length > 15) | (name.trim().length < 3)) {
    return res
      .status(httpStatusCodes.BAD_REQUEST)
      .json({ success: false, message: messages.COMMON.MIN_MAX_CHAR('name', 3, 15) });
  }
  if (description.trim().length > 20 || description.trim().length < 3) {
    return res
      .status(httpStatusCodes.BAD_REQUEST)
      .json({ success: false, message: messages.COMMON.MIN_MAX_CHAR('description', 3, 20) });
  }
  const category = await Category.findByIdAndUpdate(categoryId, req.body, { new: true });
  if (!category) {
    return res.status(httpStatusCodes.NOT_FOUND).send({ message: messages.CATEGORY.NOT_FOUND });
  }
  res
    .status(httpStatusCodes.OK)
    .json({ success: true, message: messages.CATEGORY.UPDATE_SUCCESS, category: category });
};
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
  } catch (error) {
    res.status(httpStatusCodes.BAD_REQUEST).json({ success: false, message: error.message });
  }
};
const getAddCategory = (_req, res) => {
  res.render('add-category', { currentPath: '/category', layout: 'layouts/adminLayout' });
};
const postAddCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !description) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.CATEGORY.REQUIRED_FIELDS });
    }
    if ((name.trim().length > 15) | (name.trim().length < 3)) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COMMON.MIN_MAX_CHAR('name', 3, 15) });
    }
    if (description.trim().length > 20 || description.trim().length < 3) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: messages.COMMON.MIN_MAX_CHAR('description', 3, 20) });
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
