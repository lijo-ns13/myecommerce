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
    isDeleted:{
        type:Boolean,
        default:false
    },
    deletedAt:{
        type:Date,
        default:null,
        select:false
    },
    
});

module.exports=mongoose.model('Category',categorySchema);
