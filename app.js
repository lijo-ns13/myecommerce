const express=require('express');
const dotenv=require('dotenv').config();
const nodemailer=require('nodemailer');
const path=require('path')
const cookieParser=require('cookie-parser');
const methodOverride=require('method-override')
const passport = require('passport');
require('./passport'); 
// routes
const authRouter=require('./routes/authRouter');
const adminRouter=require('./routes/adminRouter');
const userRouter=require('./routes/userRouter');
const bodyParser=require('body-parser');

const session = require('express-session');
// app.js or server.js

const googleauthRouter=require('./routes/googleauthRouter')
const productRouter=require('./routes/productRouter');
const customerRouter=require('./routes/customerRouter');
const categoryRouter=require('./routes/categoryRouter');
const userProtectedRouter=require('./routes/userprotected')
const cartRouter=require('./routes/cartRouter');
const userprofileRouter=require('./routes/userprofile')
const app=express();

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
// app.use(express.static(path.join(__dirname, 'public')));
// app.use(session({
//     secret: process.env.SESSION_SECRET || 'your_secret_key', // Replace 'your_secret_key' with a strong secret
//     resave: false,
//     saveUninitialized: false,
//     cookie: { secure: false }  // Set secure: true if using HTTPS
//   }));
  

// app.use(passport.initialize());
// app.use(passport.session());

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

app.use(methodOverride('_method'));
app.use(cookieParser())
app.use(express.json());
app.use(bodyParser.urlencoded({extended:false}));
app.use(express.json());
app.use(bodyParser.urlencoded({extended:true}))
app.set('view engine','ejs');

// Set the views directory
app.set('views', path.join(__dirname, 'views'));

app.use(googleauthRouter);

// app.use('/',landRouter)
app.use('/auth',authRouter);
app.use('/admin',adminRouter);
app.use('/admin/products',productRouter)
app.use('/admin/customers',customerRouter)
app.use('/admin/category',categoryRouter)
app.use('/',userRouter)
app.use('/user',userProtectedRouter)
app.use('/cart',cartRouter)
app.use('/user-profile',userprofileRouter)









module.exports=app;