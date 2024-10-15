const mongoose=require('mongoose');
const {Schema}=mongoose;
const User=require('./userSchema')

const orderSchema=new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        required:true,
        ref:'User'
    },
    products:[
        {
            productId:{
                type:Schema.Types.ObjectId,
                ref:'Product',
                required:true
            },
            quantity:Number,
            price:Number,
            size:{
                type:String,
                required:true
            }
        }
    ],
    totalPrice:{
        type:Number,
        required:true
    },
    shippingAddress:{
        phoneNo:{
            type:Number,
            required:true
        },
        street:{
            type:String,
            required:true
        },
        city:{
            type:String,
            required:true
        },
        state:{
            type:String,
            required:true
        },
        postalCode:{
            type:Number,
            required:true
        }
        ,country:{
            type:String,
            required:true
        }
    },
    orderDate:{
        type:Date,
        default:Date.now
    },
    deliveryDate: { type: Date } ,
    status:{
        type:String,
        enum:[ 'pending', 
            'processing',
            'shipped', 
            'delivered', 
            'pending_return',
            'processing_return',
            'initiated_return',
            'returned',
            'refunded',
            'cancelled',
            'payment_failed',
            'out_of_stock',
            'on_hold',
            'failed'],
        default:'pending'

    },
    returnReason:{
        type:String
    },
    // paymentMethod:{
    //     type:String,
    //     required:true
    // },
    paymentDetails: {
        paymentMethod: {
            type: String,
            required: true
        },
        transactionId: {
            type: String,
            required: true
        }
    },
    orderedProducts: [
        {
            productName: {
                type: String,
                required: true  // Consider adding required validation
            },
            productPrice: {
                type: Number,
                required: true  // Consider adding required validation
            },
            productQuantity: {
                type: Number,
                required: true  // Consider adding required validation
            },
            productSize: {
                type: Number,  // Changed to String to accommodate different size formats
                required: true  // Consider adding required validation
            },
            productImage:{
                type:String,
                required:true
            },
            productId:{
                type:String,
                required:true
            }
        }
    ],

    isDiscount:{
        type:Boolean,
        default:false
    },
    discount:{
        type:Number
    },
    originalPrice:{
        type:Number,
        
    }
},{
    timestamps:true
})

const Order=mongoose.model('order',orderSchema);
module.exports=Order;





