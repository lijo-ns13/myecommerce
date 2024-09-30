const Product=require('../models/productSchema')
const Offer=require('../models/offerSchema');


async function getProductsWithOffers() {
    const currentDate=new Date();

    const activeOffers=await Offer.find({
        offerStatus:'active',
        startDate:{$lte:currentDate},
        endDate:{$gte:currentDate}

    });
    const products=await Product.find().populate('category').exec();

    const productsWithOffers=products.map(product=>{
        let applicableOffer=activeOffers.find(offer=>
            offer.productIds.includes(product._id) ||
            offer.categoryIds.includes(product.category._id)
        )
    

    if(applicableOffer){
        let discountValue=0;
        if(applicableOffer.discountType==='percentage'){
            discountValue=applicableOffer.discountValue/100*product.price;
        }else if(applicableOffer.discountType==='fixed'){
            discountValue=applicableOffer.discountValue;

        }

        const finalPrice=product.price-discountValue;
        return {
            ...product.toObject(),
            offerApplied:true,
            finalPrice,
            discountValue,
            offerDetails:applicableOffer
        }
    }
    return {
        ...product.toObject(),
        offerApplied:false,
        
        finalPrice:product.price
    }
})
return productsWithOffers;
}

module.exports={
    getProductsWithOffers
}