const express=require('express');
const methodOverride=require('method-override')
const Product = require('../models/productSchema'); // Adjust the path to your Product model
const Category=require('../models/categorySchema')
const Offer=require('../models/offerSchema')
const {jwtAuth,adminProtected}=require('../middlewares/auth');
const Cart=require('../models/cartSchema')
const router=express.Router();
router.use(express.urlencoded({ extended: true })); // To parse form data
router.use(methodOverride('_method')); 

router.use(jwtAuth,adminProtected)




router.get('/offers', async (req, res) => {
  try {
    const offers = await Offer.find({}).populate('categoryIds');
    // if (!offers || offers.length === 0) {
    //   return res.status(400).json({ success: false, message: 'Offers not found' });
    // }
    const products=await Product.find()
    res.render('adminoffer/offer', { offers ,products});
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/offers/add-offer', async (req, res) => {
  try {
    const categories = await Category.find({});
    const products = await Product.find({}); // Fetch all products as well
    res.render('adminoffer/addoffer', { categories, products }); // Pass products to the template
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.post('/offers/add-offer', async (req, res) => {
  try {
    const {
      offerName,
      offerType,
      discountType,
      discountValue,
      startDate,
      endDate,
      offerStatus,
      offerDescription,
      productSelection = [],
      categorySelection = []
    } = req.body;

    console.log(req.body, 'req.body');

    // Validation checks
    if (!offerName) {
      return res.status(400).json({ success: false, message: "OfferName is required" });
    }
    if (!offerType) {
      return res.status(400).json({ success: false, message: "OfferType is required" });
    }
    if (!discountType) {
      return res.status(400).json({ success: false, message: "DiscountType is required" });
    }
    if (!discountValue) {
      return res.status(400).json({ success: false, message: "DiscountValue is required" });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Start and End Date are required" });
    }
    if (!offerStatus) {
      return res.status(400).json({ success: false, message: "OfferStatus is required" });
    }
    if (!offerDescription) {
      return res.status(400).json({ success: false, message: "OfferDescription is required" });
    }

    const regex = /^[A-Z0-9]+$/;
    if (!regex.test(offerName)) {
      return res.status(400).json({ success: false, message: 'Only capital letters and numbers are allowed' });
    }

    // Check if the offer type is valid
    const validOfferTypes = ['category', 'product'];
    if (!validOfferTypes.includes(offerType)) {
      return res.status(400).json({ success: false, message: 'Invalid offer type' });
    }

    // Validate discount value
    if (discountValue >= 60) {
      return res.status(400).json({ success: false, message: 'Discount Value must be less than 60' });
    }
    if (discountValue <= 0) {
      return res.status(400).json({ success: false, message: "Discount Value must be greater than 0" });
    }

    // Validate startDate and endDate
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({ success: false, message: 'End date must be after start date' });
    }
    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }

    const validStatuses = ['active', 'inactive'];
    if (!validStatuses.includes(offerStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid offer status' });
    }

    const existingOffers = await Offer.find({ offerName: offerName });
    if (existingOffers.length > 0) {
      return res.status(400).json({ success: false, message: 'An offer with this name already exists.' });
    }

    // Ensure that categorySelection and productSelection are arrays
    const categoryIds = Array.isArray(categorySelection) ? categorySelection : (categorySelection ? [categorySelection] : []);
    const productIds = Array.isArray(productSelection) ? productSelection : (productSelection ? [productSelection] : []);

    // Validate category or product selection
    if (offerType === 'category' && categoryIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one category' });
    }
    if (offerType === 'product' && productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one product' });
    }

    // Check for overlapping offers if offerType is 'category'
    const overlappingOffers = await Offer.find({
      offerType: offerType,
      startDate: { $lt: endDate },
      endDate: { $gt: startDate },
      ...(offerType === 'category' ? { categoryIds: { $in: categoryIds } } : { productIds: { $in: productIds } }),
      offerStatus: 'active'
    });
    if (overlappingOffers.length > 0) {
      return res.status(400).json({ success: false, message: 'An overlapping offer already exists for the selected category or product during this date range.' });
    }

    // Create new offer
    const offer = new Offer({
      offerName,
      offerType,
      discountType,
      discountValue,
      startDate: start,
      endDate: end,
      offerStatus,
      offerDescription,
      ...(offerType === 'category' ? { categoryIds: categoryIds } : { productIds: productIds })
    });

    // Handle applying the offer to products based on the selection
    if (offerType === 'category' && categoryIds.length > 0) {
      // Fetch products that belong to the selected categories
      const products = await Product.find({ category: { $in: categoryIds } });
      await applyOfferToProducts(products, offer, discountValue, discountType);
    } else if (offerType === 'product' && productIds.length > 0) {
      // Fetch selected products
      const products = await Product.find({ _id: { $in: productIds } });
      await applyOfferToProducts(products, offer, discountValue, discountType);
    }

    // Save the offer
    await offer.save();
    res.status(200).json({ success: true, message: 'Offer created successfully' });
  } catch (error) {
    console.log('add offer error', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Function to apply offer to products
async function applyOfferToProducts(products, offer, discountValue, discountType) {
  await Promise.all(products.map(async (product) => {
    const discountAmount = discountType === 'percentage' ? (product.price * discountValue / 100) : discountValue;
    const newPrice = product.price - discountAmount;
    if (newPrice < product.finalPrice) {
      product.finalPrice = Math.floor(newPrice);
    }
    product.offerApplied = true;
    product.offers.push(offer._id); // Add the offer ID to the product's offers array
    await product.save(); // Save the updated product

    // Update cart final price if necessary
    const cartItems = await Cart.find({ 'products.productId': product._id });
    for (const cart of cartItems) {
      let totalPrice = 0;
      let finalTotalPrice = 0;
      for (const item of cart.products) {
        if (item.productId.equals(product._id)) {
          totalPrice += product.price * item.quantity;
          finalTotalPrice += (product.finalPrice) * item.quantity;
        }
      }
      // Update the cart prices
      await Cart.updateOne(
        { _id: cart._id },
        { $set: { finalTotalPrice, finalPrice: finalTotalPrice } }
      );
    }
  }));
}

// GET route to render the edit offer form
router.get('/offers/edit-offer/:id', async (req, res) => {
  try {
      const offerId = req.params.id;
      const offer = await Offer.findById(offerId); // Fetch the specific offer
      console.log('Fetched offer:', offer);

      if (!offer) {
          // return res.status(404).render('errorPage', { message: 'Offer not found' }); // Render an error page
          return res.status(404).json({success:false,message:'offer not found'})
      }

      // Fetch all products and categories to populate the select options
      const categories = await Category.find();
      const products = await Product.find();
      console.log('Categories:', categories);
      console.log('Products:', products);

      res.render('adminoffer/editoffer', {
          offer,
          categories,  // Pass categories to the template
          products     // Pass products to the template
      });
  } catch (error) {
      console.error('Error fetching offer for editing:', error.message);
      res.status(500).json({ success: false, message: error.message });
  }
});

// POST route to handle form submission for editing an offer
router.post('/offers/edit-offer/:id', async (req, res) => {
  const offerId = req.params.id;

  // Destructure the incoming request body
  const {
      offerName,
      offerType,
      discountType,
      discountValue,
      startDate,
      endDate,
      offerStatus,
      offerDescription,
      categorySelection = [],
      productSelection = []
  } = req.body;

  try {
      // Input validation
      if (!offerName || !offerType || !discountType || !discountValue || !startDate || !endDate || !offerStatus || !offerDescription) {
          return res.status(400).json({ success: false, message: "All fields are required." });
      }

      // Offer Name validation
      const regex = /^[A-Z0-9]+$/;
      if (!regex.test(offerName)) {
          return res.status(400).json({ success: false, message: 'Only capital letters and numbers are allowed for Offer Name.' });
      }

      // Discount Value validation
      if (discountValue >= 60 || discountValue <= 0) {
          return res.status(400).json({ success: false, message: 'Discount Value must be between 1 and 59.' });
      }

      // Date validation
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start) || isNaN(end) || start >= end) {
          return res.status(400).json({ success: false, message: 'Invalid date range: Start date must be before End date.' });
      }

      // Find existing offer
      const existingOffer = await Offer.findById(offerId);
      if (!existingOffer) {
          return res.status(404).json({ success: false, message: 'Offer not found' });
      }

      // Update offer details
      existingOffer.offerName = offerName;
      existingOffer.offerType = offerType; // Changed to match previous naming
      existingOffer.discountType = discountType;
      existingOffer.discountValue = discountValue;
      existingOffer.startDate = start;
      existingOffer.endDate = end;
      existingOffer.offerStatus = offerStatus;
      existingOffer.offerDescription = offerDescription;

      // Set selections based on offer type
      if (offerType === 'category') {
          existingOffer.categoryIds = categorySelection; // Only categories
          existingOffer.productIds = []; // Clear product selection
      } else if (offerType === 'product') {
          existingOffer.productIds = productSelection; // Only products
          existingOffer.categoryIds = []; // Clear category selection
      }

      // Save the updated offer
      await existingOffer.save();

      // Apply the offer to products if it's a category-based offer
      if (offerType === 'category') {
          const productsToUpdate = await Product.find({ category: { $in: categorySelection } });
          await applyOfferToProducts(productsToUpdate, existingOffer, discountValue, discountType);
      }

      // Optionally, apply the offer to products if it's a product-based offer
      if (offerType === 'product') {
          const productsToUpdate = await Product.find({ _id: { $in: productSelection } });
          await applyOfferToProducts(productsToUpdate, existingOffer, discountValue, discountType);
      }

      // Redirect or respond with success
      res.status(200).redirect('/admin/offers'); // Redirecting to offers list after successful edit
  } catch (error) {
      console.error('Error updating offer:', error.message);
      res.status(500).json({ success: false, message: error.message });
  }
});


router.delete('/offers/delete-offer/:offerId', async (req, res) => {
  const offerId = req.params.offerId;

  try {
      // Step 1: Find the offer by ID
      const offer = await Offer.findById(offerId);
      if (!offer) {
          return res.status(404).json({ success: false, message: 'Offer not found' });
      }

      // Step 2: Find products associated with the offer
      const products = await Product.find({ offers: offerId });
      console.log('Products associated with the offer before deletion:', products);

      // Step 3: Remove the offer from the products
      await Product.updateMany(
          { offers: offerId },
          { $pull: { offers: offerId } } // Remove the offerId from the offers array
      );

      // Step 4: Reset finalPrice and offerApplied for each product
      for (const product of products) {
          await Product.updateOne(
              { _id: product._id },
              {
                  $set: {
                      finalPrice: product.price, // Reset finalPrice to the original price
                      offerApplied: false         // Reset offerApplied to false
                  }
              }
          );
      }

    
    // Step 5: Update cart final prices if necessary
    const productIds = products.map(product => product._id);
    const cartItems = await Cart.find({ 'products.productId': { $in: productIds } });

    for (const cart of cartItems) {
        let totalPrice = 0;
        let finalTotalPrice = 0;
        for (const item of cart.products) {
            const updatedProduct = products.find(p => {
              console.log('p.id',typeof(p._id),typeof(item.productId))
              return p._id.equals(item.productId)});
              console.log('updateproduct',updatedProduct)
            if (updatedProduct) {
                const quantity = item.quantity;
                totalPrice += updatedProduct.price * quantity; // Original price
                finalTotalPrice += updatedProduct.price * quantity; // Updated final price
            }
        }
        // Update the cart prices
        console.log('Updating cart ID:', cart._id, 'Total Price:', totalPrice, 'Final Total Price:', finalTotalPrice);
        await Cart.updateOne(
            { _id: cart._id },
            { $set: { finalTotalPrice, finalPrice: totalPrice } }
        );
    }
      // Step 6: Delete the offer
      await Offer.findByIdAndDelete(offerId);

      return res.status(200).json({ success: true, message: 'Offer deleted successfully' });
  } catch (error) {
      console.error('Error deleting offer:', error);
      return res.status(500).json({ success: false, message: 'An error occurred while deleting the offer.' });
  }
});
module.exports=router;