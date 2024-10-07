const mongoose=require('mongoose');
const {Schema}=mongoose;



const wishlistModel = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
});
const Wishlist=mongoose.model('Wishlist',wishlistModel);
module.exports=Wishlist;