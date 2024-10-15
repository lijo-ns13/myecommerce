const mongoose=require('mongoose');
const {Schema}=mongoose;

const categorySchema = new Schema({
    name: {
        type: String,
        required: true,
        unique:true,
        trim: true
    },
    description: String,
    // isDeleted:{
    //     type:Boolean,
    //     default:false
    // },
    // deletedAt:{
    //     type:Date,
    //     default:null,
    //     select:false
    // },
    isBlocked:{
        type:Boolean,
        default:false
        
    },
    orderCount:{
        type:Number,
        default:0
    }
    
});

module.exports=mongoose.model('Category',categorySchema);
