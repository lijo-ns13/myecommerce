const express=require('express');
const dotenv=require('dotenv').config();
const nodemailer=require('nodemailer');
const path=require('path')
const cookieParser=require('cookie-parser');
const methodOverride = require('method-override');
const passport = require('passport');
require('./passport'); 
// routes
const authRouter=require('./routes/authRouter');
const adminRouter=require('./routes/adminRouter');
const userRouter=require('./routes/userRouter');

const bodyParser=require('body-parser');
const noCache=require('nocache')
const session = require('express-session');


const googleauthRouter=require('./routes/googleauthRouter')
const productRouter=require('./routes/productRouter');
const customerRouter=require('./routes/customerRouter');
const categoryRouter=require('./routes/categoryRouter');
const userProtectedRouter=require('./routes/userprotected')
const cartRouter=require('./routes/cartRouter');
const userprofileRouter=require('./routes/userprofile')
const addressRouter=require('./routes/addressRouter')
const wishlistRouter=require('./routes/wishlistRouter')
const checkoutRouter=require('./routes/checkoutRouter')
const orderRouter=require('./routes/orderRouter')
const adminOrderRouter=require('./routes/adminOrderRouter')

const app=express();
app.use(noCache())
app.use(cookieParser())
app.use('/',userRouter)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key', // Replace 'your_secret_key' with a strong secret
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }  // Set secure: true if using HTTPS
  }));
  

app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Callback route after Google authentication
app.get('/auth/google/callback', passport.authenticate('google', { session: false }), (req, res) => {
    // Successful authentication
    if (req.user && req.user.token) {
        // res.redirect(`/home?token=${req.user.token}`);
        res.cookie('token', req.user.token, { httpOnly: true });
        res.redirect('/')
    } else {
        res.redirect('/login');
    }
});





app.set('view engine','ejs');

// Set the views directory
app.set('views', path.join(__dirname, 'views'));

app.use(googleauthRouter);

// app.use('/',landRouter)
app.use('/',userRouter)
app.use('/auth',authRouter);
app.use('/admin',adminRouter);
app.use('/admin/products',productRouter)
app.use('/admin/customers',customerRouter)
app.use('/admin/category',categoryRouter)
app.use('/admin/orders',adminOrderRouter)

app.use('/user',userProtectedRouter)
app.use('/cart',cartRouter)
app.use('/user-profile',userprofileRouter);
app.use('/user/address',addressRouter)
app.use('/user/wishlist',wishlistRouter)
app.use('/checkout',checkoutRouter)
app.use('/user/orders',orderRouter)







module.exports=app;