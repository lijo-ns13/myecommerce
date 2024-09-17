const mongoose=require('mongoose');
const User=require('./userSchema')
const {Schema}=mongoose;
const addressSchema = new Schema({
    phoneNo:{
        type:String,
        requried:true
    },
    street: {
        type: String,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    postalCode: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    },
    user:{
        type: Schema.Types.ObjectId,
        ref:'User'
    }

},{
    timestamps: true
});
const Address = mongoose.model('Address', addressSchema);
module.exports=Address;