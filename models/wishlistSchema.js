const mongoose=require('mongoose');
const {Schema}=mongoose;



const wishlistModel = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }] // Ensure this is set up correctly
});
const Wishlist=mongoose.model('Wishlist',wishlistModel);
module.exports=Wishlist;