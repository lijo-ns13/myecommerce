const express=require('express');
const dotenv=require('dotenv').config();
const nodemailer=require('nodemailer');
const path=require('path')
const cookieParser=require('cookie-parser');
const methodOverride = require('method-override');
const passport = require('passport');
require('./passport'); 

const Razorpay=require('razorpay')

const bodyParser=require('body-parser');
// const noCache=require('nocache')
const noCache=require('./middlewares/noCache')
const session = require('express-session');


const googleauthRouter=require('./routes/googleauthRouter')


// routes
const authRouter=require('./routes/authRouter');

// admin router
const adminRouter=require('./routes/adminRouter');

// user router
const userRouter=require('./routes/userRouter');
const cartRouter=require('./routes/cartRouter');
const userprofileRouter=require('./routes/userprofile')
const addressRouter=require('./routes/addressRouter')
const wishlistRouter=require('./routes/wishlistRouter')
const checkoutRouter=require('./routes/checkoutRouter')
const orderRouter=require('./routes/orderRouter')
const allRouter=require('./routes/all')

const app=express();
app.use(noCache)
app.use(cookieParser())
app.use('/',userRouter)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key', 
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


// app.post('/verify-payment', async (req, res) => {
//     const { paymentId, orderId, signature } = req.body;

//     const expectedSignature = crypto.createHmac('sha256', '0oJyfx0TqcxmRsgNKTq9o05M')
//         .update(orderId + '|' + paymentId)
//         .digest('hex');

//     if (expectedSignature === signature) {
//         // Payment is verified
//         res.json({ success: true });
//     } else {
//         // Payment verification failed
//         res.json({ success: false });
//     }
// });



app.set('view engine','ejs');

// Set the views directory
app.set('views', path.join(__dirname, 'views'));

app.use(googleauthRouter);


app.use('/',userRouter)
app.use('/auth',authRouter);
app.use('/admin',adminRouter);



const razorpay = new Razorpay({
    key_id: 'rzp_test_HcIqECgcTGh7Na',
    key_secret: '0oJyfx0TqcxmRsgNKTq9o05M',
});

// Create order API
app.post('/api/create-order', async (req, res) => {
    const amount = 339600; // Example amount, replace with your actual amount
    const options = {
        amount: amount, // Amount in smallest currency unit
        currency: "INR",
        receipt: "receipt#1" // Unique receipt ID for the order
    };
    
    try {
        const order = await razorpay.orders.create(options);
        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: 'rzp_test_HcIqECgcTGh7Na' ,
            message:'checking'// Replace with your Razorpay Key
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creating Razorpay order' });
    }
});

app.use('/cart',cartRouter)
app.use('/user/profile',userprofileRouter);
app.use('/user/address',addressRouter)
app.use('/user/wishlist',wishlistRouter)
app.use('/checkout',checkoutRouter)
app.use('/user/orders',orderRouter)
app.use('/',allRouter)

// 404 Handler for undefined routes
// app.use((req, res, next) => {
//     res.status(404).render('404'); // Render the 404 EJS page
// });
// // Centralized Error Handling Middleware
// app.use((err, req, res, next) => {
//     console.error('Error:', err); // Log error for debugging
//     const status = err.status || 500; // Default to 500 if no status is set
//     if (status === 404) {
//         return res.status(404).render('404'); // Render 404 page for 404 errors
//     }
//     res.status(status).render('500'); // Render a different page for other errors, if desired
// });





module.exports=app;