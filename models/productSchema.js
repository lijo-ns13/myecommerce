const mongoose=require('mongoose');
const {Schema}=mongoose;
const Category=require('./categorySchema');

const Review=require('./reviewSchema')
const productSchema=new Schema({
    product:{
        type:String,
        required:true,
        trim:true,
        minLength:[4,"minimum length is 4 required"]
    },
    brand:{
        type:String,
        required:true,
        trim:true,
        minLength:[4,"minimum length is 4 required"]

    },
    price:{
        type:Number,
        required:true
    },
    description:{
        type:String,
        required:true,
        minLength:[5,"minimum length is 8 required"]
    },
    size:{
        type:[Number],
        required:true,
        min:[1,'minimum 1 size is required']
    },
    stock:{
        type:Number,
        required:true,
        min:[1,'minimum 1 stock is required']
    },
    images: [{
        id: { type: String, required: true },
        secured_url: { type: String, required: true }
    }],
    
    category:{
        type:Schema.Types.ObjectId,
        ref:'Category',
        required:true
    },
    reviews:[
        {
            type:Schema.Types.ObjectId,
            ref:'Review'
        }
    ],
    isListed:{
        type:Boolean,
        default:true
    }
},{
    timestamps:true
})

const Product=mongoose.model('Product',productSchema)
module.exports=Product;


// productname-string]brand-string]description-string]price]catogory-objectId]rating


// productname,brand,description,price,category,reivews,rating,images,size