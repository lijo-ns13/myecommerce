const mongoose=require('mongoose');
const { Schema }=mongoose;
const dotenv=require('dotenv').config()
const JWT=require('jsonwebtoken');
const bcrypt=require('bcrypt');
const crypto=require('crypto');
const Cart=require('./cartSchema');
const Address=require('./addressSchema')
const Wishlist=require('./wishlistSchema')
// user
const userSchema=new Schema({
    googleId:{
        type:String
    },
    name:{
        type:String,
        required:[true,'enter name'],
        trim:true,
        maxlength:[20,'name cannot exceed 20 characters'],
        minlength:[6,'minimum 6 characters'],

    },
    email:{
        type:String,
        required:[true,'email required'],
        unique:[true,'already registred'],
        lowercase:true,
        trim:true
        
    },
    password:{
        type:String,
        select:false

    },
    role:{
        type:String,
        enum:['user','admin'],
        default:'user'
    }
    ,
    address: [{
        type: Schema.Types.ObjectId,
        ref: 'Address'
    }],
    wishlist:[
        {
            type:Schema.Types.ObjectId,
            ref:'Wishlist',
            default:[]
        }
    ],
    cart: {
        type: Schema.Types.ObjectId,
        ref: 'Cart',  
        default: null
    },
    forgotPasswordToken:{
        type:String
    },
    forgotPasswordExpiry:{
        type:Date
    },
    isBlocked:{
        type:Boolean,
        select:false,
        default:false
    }
},{
    timestamps:true
})
userSchema.pre('save',async function(next){
    const user = this;
    if (user.isModified('password')) {
        user.password = await bcrypt.hash(user.password, 8);
    }
    next();
})
userSchema.methods.getForgotPasswordToken = function() {
    const forgotToken = crypto.randomBytes(20).toString('hex');

    this.forgotPasswordToken = crypto
        .createHash('sha256')
        .update(forgotToken)
        .digest('hex');

    this.forgotPasswordExpiry = Date.now() + 20 * 60 * 1000; // Token expires in 20 minutes
    return forgotToken;
};

const userModel=mongoose.model('User',userSchema);
module.exports=userModel;