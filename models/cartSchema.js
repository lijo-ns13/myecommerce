const mongoose=require('mongoose');
const User=require('./userSchema');
const Product=require('./productSchema');

const {Schema}=mongoose;

const cartSchema=new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    products:[
        {
            productId:{
                type:Schema.Types.ObjectId,
                ref:'Product',
                required:true
            },
            size: {
                type: Number,
                required: true
            },
            quantity:{
                type:Number,
                required:true,
                default:1
            }
        }
    ],
    totalPrice:{
        type:Number,
        required:true,
        default:0
    },
    status: {
        type: String,
        enum: ['active', 'checked out'],
        default: 'active'
      }
})
cartSchema.pre('save', async function (next) {
    if (this.isModified('products')) {
        try {
            const cart = this;
            let totalPrice = 0;

            // Collect all product IDs and quantities
            const productIds = cart.products.map(p => p.productId);
            const quantities = cart.products.map(p => p.quantity);

            // Fetch products and create a map of prices
            const products = await Product.find({ _id: { $in: productIds } }).exec();

            // Create a map for product prices
            const priceMap = new Map();
            products.forEach(product => {
                priceMap.set(product._id.toString(), product.price);
            });

            // Calculate total price
            for (let i = 0; i < productIds.length; i++) {
                const productId = productIds[i].toString();
                const quantity = quantities[i];
                const price = priceMap.get(productId);

                if (price) {
                    totalPrice += price * quantity;
                } else {
                    console.error(`Price not found for product ID: ${productId}`);
                }
            }

            cart.totalPrice = totalPrice;

        } catch (error) {
            return next(error);
        }
    }

    next();
});

const Cart=mongoose.model('Cart',cartSchema);
module.exports=Cart;