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
            price:Number
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
    deliveryDate:{
        type:Date
    },
    status:{
        type:String,
        enum:['pending','shipped','delivered',
            'cancelled'
        ],
        default:'pending'

    },
    paymentMethod:String
},{
    timestamps:true
})

const Order=mongoose.model('order',orderSchema);
module.exports=Order;





