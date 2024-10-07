const mongoose=require('mongoose');
const {Schema}=mongoose;

const couponSchema=new Schema({
    couponCode:{
        type:String,
        required:true,
        unique:true
    },
    discountType:{
        type:String,
        required:true,
        enum:['percentage'],
        default:'percentage'
    },
    discountValue:{
        type:Number,
        required:true,
        min:0,
        default:0
    },
    startDate:{
        type:Date,
        required:true
    },
    endDate:{
        type:Date,
        required:true
    },
    minPurchaseAmount:{
        type:Number,
        required:true,

    },
    usageLimit:{
        type:Number,
        required:true,
        default:0
    },
    isDeleted:{
        type:Boolean,
        required:true,
        default:false,

    },
    usedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'  // Reference to the User model
    }]
},{
    timestamps:true
})
const couponModel=mongoose.model('coupon',couponSchema);
module.exports=couponModel;