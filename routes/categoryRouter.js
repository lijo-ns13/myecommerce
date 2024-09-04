const express=require('express');
const router=express.Router();
const categoryController=require('../controllers/categoryController')
const {jwtAuth,adminProtected}=require('../middlewares/auth')

router.use(jwtAuth,adminProtected);

router.get('/',categoryController.getCategory)
router.get('/update/:id',categoryController.getUpdateCategory)

router.patch('/update/:id',categoryController.patchUpdateCategory)
router.delete('/delete/:id',categoryController.deleteCategory)
router.get('/add-category',categoryController.getaddcategory)
router.post('/add-category',categoryController.postaddCategory)




module.exports=router;