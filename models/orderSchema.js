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
            'cancelled',
            'returned',
            'refunded',
            'out_of_stock',
            'on_hold',
            'failed'],
        default:'pending'

    },
    paymentMethod:{
        type:String,
        required:true
    }
},{
    timestamps:true
})

const Order=mongoose.model('order',orderSchema);
module.exports=Order;





