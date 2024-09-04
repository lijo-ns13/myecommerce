const express=require('express');

const {jwtAuth,adminProtected,userProtected}=require('../middlewares/auth');
const adminController=require('../controllers/adminController')

const router=express.Router();


router.use(jwtAuth,adminProtected)


router.get('/dashboard',adminController.getDashboard)


module.exports=router;