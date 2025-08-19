const express = require("express");
const userModel = require("../models/userSchema");
const Products = require("../models/productSchema");
const Product = require("../models/productSchema");
const JWT = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv").config();
const cookieParser = require("cookie-parser");
const Category = require("../models/categorySchema");
const Cart = require("../models/cartSchema");
const User = require("../models/userSchema");

const { jwtAuth } = require("../middlewares/auth");

const router = express.Router();
router.use(cookieParser());
// controller
const userController = require("../controllers/userController");

const { getProductsWithOffers } = require("../services/productService");

router.use(jwtAuth);

router.get("/", userController.getLand);
router.get("/product-detail/:productId", userController.getProductDetailed);
router.get("/products", userController.getFullProducts);

router.get("/offerproducts", userController.getOffer);

module.exports = router;
