const mongoose=require('mongoose');
const {Schema}=mongoose;

const bannerSchema=new Schema({
    bannerName:{
        type:String,
        required:true,

    },
    description:{
        type:String,
        required:true
    },
    image:{
        type:String,
        required:true
    }
})

const Banner = mongoose.model('Banner', bannerSchema);
module.exports=Banner;
