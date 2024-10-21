const express=require('express');
const dotenv=require('dotenv').config();
const nodemailer=require('nodemailer');
const path=require('path')
const cookieParser=require('cookie-parser');
const methodOverride = require('method-override');
const passport = require('passport');
require('./passport'); 
const crypto = require('crypto');
const Order=require('./models/orderSchema')
const Product=require('./models/productSchema')

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
const reviewRouter=require('./routes/reviewRouter')

const app=express();
app.use(noCache)
app.use(cookieParser())
app.use('/',userRouter)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static('public'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.static('uploads'))
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

// 99999999999999999999999999999999999

// Initialize Razorpay
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID, // Use your Razorpay key ID
    key_secret: process.env.RAZORPAY_KEY_SECRET // Use your Razorpay secret
});

app.post('/api/verify-payment', async (req, res) => {
    const { orderId, paymentId, signature } = req.body;

    console.log('Verifying payment:');
    console.log('Order ID:', orderId);
console.log('Payment ID:', paymentId);
console.log('Received Signature:', signature);


    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${orderId}|${paymentId}`);  // Ensure correct concatenation
    const generatedSignature = hmac.digest('hex');

    console.log('Generated signature:', generatedSignature);

    if (generatedSignature === signature) {
        console.log(`Payment verified for orderId: ${orderId}`);
        return res.json({ success: true });
    } else {
        console.error('Payment verification failed for orderId:', orderId,signature);
        return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
});

app.post('/update-order-status/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    try {
        const order = await Order.findById(orderId); // Assuming products is an array of { productId, quantity, size }

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Store product restock info immediately for rollback
        const productRestockInfo = order.products.map(item => ({
            productId: item.productId, // Assuming productId is stored in the product object
            size: item.size, // Assuming each order item has a size
            quantity: item.quantity,
        }));


        // Update order status
        order.status = status;

        // Save the order
        await order.save();

        // If the order status is failed, restock the products
        if (status === 'payment_failed') {
            const productsToUpdate = await Product.find({
                _id: { $in: productRestockInfo.map(info => info.productId) }
            });

            await Promise.all(productsToUpdate.map(async (product) => {
               
                const sizeInfo = productRestockInfo.find(info =>{
                    console.log('infoproductid',info.productId,'productid',product._id,typeof(info.productId),typeof(product._id)) 
                    return info.productId.equals(product._id)});
                if (sizeInfo) {
                    const sizeEntry = product.sizes.find(s =>{ 
                        console.log('s.size',s.size,'sizeInfo',sizeInfo.size,typeof(s.size),typeof(sizeInfo.size))
                        return s.size.toString() === sizeInfo.size.toString()});
                    if (sizeEntry) {
                        sizeEntry.stock += sizeInfo.quantity; // Increase stock for the specific size
                        await product.save();
                    } else {
                        console.error(`Size ${sizeInfo.size} not found for product ID: ${product._id}`);
                    }
                }
            }));
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('Error updating order status:', error);

        await Promise.all(productRestockInfo.map(async ({ productId, size, quantity }) => {
            const product = await Product.findById(productId);
            if (product) {
                const sizeEntry = product.sizes.find(s => s.size === size);
                if (sizeEntry) {
                    sizeEntry.stock += quantity; // Rollback by increasing the stock
                    await product.save();
                }
            }
        }));

        return res.status(500).json({ success: false, message: 'Failed to update order status' });
    }
});

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

app.post('/create-order', async (req, res) => {
    const { amount, orderId } = req.body; // Accept orderId in request
    const options = {
        amount: amount * 100,
        currency: "INR",
        receipt: orderId,
        payment_capture: 1,
    };

    try {
        const order = await instance.orders.create(options);
        res.json({ razorpayOrderId: order.id, orderId: orderId });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error creating order");
    }
});

// Server-side code (in your Express app)
app.post('/api/verify-paymenttwo', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Invalid input data.' });
    }

    try {
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generatedSignature === razorpay_signature) {
            const result = await Order.updateOne({ _id: order_id }, { status: 'pending' });
            if (result.modifiedCount === 0) {
                return res.status(404).json({ success: false, message: 'Order not found or status already updated.' });
            }

            return res.json({ success: true });
        } else {
            return res.json({ success: false, message: 'Payment verification failed. Invalid signature.' });
        }
    } catch (err) {
        console.error('Payment verification error:', err);
        return res.status(500).json({ success: false, message: 'Payment verification error. Please try again later.' });
    }
});

app.set('view engine','ejs');

// Set the views directory
app.set('views', path.join(__dirname, 'views'));

app.use(googleauthRouter);


app.use('/',userRouter)
app.use('/auth',authRouter);
app.use('/admin',adminRouter);



app.use('/cart',cartRouter)
app.use('/user/profile',userprofileRouter);
app.use('/user/address',addressRouter)
app.use('/user/wishlist',wishlistRouter)
app.use('/checkout',checkoutRouter)
app.use('/user/orders',orderRouter)
app.use('/',allRouter)
app.use('/user/review',reviewRouter)


module.exports=app;