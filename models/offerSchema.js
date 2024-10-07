const mongoose=require('mongoose');
const {Schema}=mongoose;


const offerSchema=new Schema({
    offerName:{
        type:String,
        required:true,
        unique:true,

    },
    offerType:{
        type:String,
        required:true,
        enum:['category','product'],

    },

    offerDescription:{
        type:String,
        required:true,

    },
    discountType:{
        type:String,
        enum:['percentage'],
        required:true,

    },
    discountValue:{
        type:Number,
        required:true,

    },
    startDate:{
        type:Date,
        required:true,

    },
    endDate:{
        type:Date,
        required:true,

    },
    offerStatus:{
        type:String,
        enum:['active','inactive']
    },
    categoryIds:[
        {
            type:Schema.Types.ObjectId,
            ref:'Category',
            required:function(){
                return this.offerType==='category'
            },

        }
    ],
    productIds: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: function() {
                return this.offerType === 'product';
            },
        }
    ]
})
const offerModel=mongoose.model('Offer',offerSchema);
module.exports=offerModel;