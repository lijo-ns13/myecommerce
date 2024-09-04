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
const Cart=mongoose.model('Cart',cartSchema);
module.exports=Cart;