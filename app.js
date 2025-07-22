const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const passport = require('passport');
require('./passport');
// const noCache=require('nocache')
const noCache = require('./middlewares/noCache');
const session = require('express-session');

// updated
const authRouter = require('./routes/auth/auth.routes');
const adminRouter = require('./routes/admin/index');
const userRouter = require('./routes/user/index');

const googleauthRouter = require('./routes/googleauthRouter');

// // routes
// const authRouter=require('./routes/authRouter');

// const adminRouter=require('./routes/adminRouter');
// // user
// const userRouter=require('./routes/userRouter');
// const cartRouter=require('./routes/cartRouter');
// const userprofileRouter=require('./routes/userprofile')
// const addressRouter=require('./routes/addressRouter')
// const wishlistRouter=require('./routes/wishlistRouter')
// const checkoutRouter=require('./routes/checkoutRouter')
// const orderRouter=require('./routes/orderRouter')
const allRouter = require('./routes/all');
// const reviewRouter=require('./routes/reviewRouter')
// const paymentRouter=require('./routes/paymentRouter')

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(noCache);
app.use(cookieParser());
app.use('/', userRouter);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static('public'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.static('uploads'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Callback route after Google authentication
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    // Successful authentication
    if (req.user && req.user.token) {
      // res.redirect(`/home?token=${req.user.token}`);
      res.cookie('token', req.user.token, { httpOnly: true });
      res.redirect('/');
    } else {
      res.redirect('/login');
    }
  }
);

app.use(googleauthRouter);

// app.use('/', userRouter);
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/', userRouter);
app.use('/', allRouter);

// app.use('/cart',cartRouter)
// app.use('/user/profile',userprofileRouter);
// app.use('/user/address',addressRouter)
// app.use('/user/wishlist',wishlistRouter)
// app.use('/checkout',checkoutRouter)
// app.use('/user/orders',orderRouter)

// app.use('/user/review',reviewRouter)
// app.use('/api',paymentRouter)

module.exports = app;
