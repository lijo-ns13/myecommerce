const Product = require('../../models/productSchema');
const Offer = require('../../models/offerSchema');
const Cart = require('../../models/cartSchema');
const Category = require('../../models/categorySchema');
const httpStatusCodes = require('../../constants/httpStatusCodes');
// Apply the best active offer for a single product
async function applyBestOfferToProduct(product) {
  const now = new Date();

  const offers = await Offer.find({
    offerStatus: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [{ productIds: product._id }, { categoryIds: product.category }],
  });

  if (!offers.length) {
    product.finalPrice = product.price;
    product.offerApplied = false;
    product.offers = [];
    await product.save();
    return;
  }

  let maxDiscount = 0;
  let bestOfferIds = [];

  offers.forEach((offer) => {
    const discountAmount =
      offer.discountType === 'percentage'
        ? (product.price * offer.discountValue) / 100
        : offer.discountValue;

    if (discountAmount > maxDiscount) {
      maxDiscount = discountAmount;
      bestOfferIds = [offer._id];
    } else if (discountAmount === maxDiscount) {
      bestOfferIds.push(offer._id);
    }
  });

  product.finalPrice = Math.floor(product.price - maxDiscount);
  product.offerApplied = true;
  product.offers = bestOfferIds;
  await product.save();
}

// Apply best offers to a list of products and update carts
async function applyOffersToProductsAndUpdateCarts(products) {
  await Promise.all(
    products.map(async (product) => {
      await applyBestOfferToProduct(product);

      // Update carts containing this product
      const cartItems = await Cart.find({ 'products.productId': product._id });
      for (const cart of cartItems) {
        let totalPrice = 0;
        let finalTotalPrice = 0;

        // Create a map of productId => product for efficient lookup
        const productIds = cart.products.map((p) => p.productId);
        const productDocs = await Product.find({ _id: { $in: productIds } });
        const productMap = new Map(productDocs.map((p) => [p._id.toString(), p]));

        for (const item of cart.products) {
          const p = productMap.get(item.productId.toString());
          if (p) {
            totalPrice += p.price * item.quantity;
            finalTotalPrice += p.finalPrice * item.quantity;
          }
        }

        await Cart.updateOne(
          { _id: cart._id },
          { $set: { finalTotalPrice, finalPrice: finalTotalPrice } }
        );
      }
    })
  );
}

// ------------------- OFFER CONTROLLERS -------------------

// Add a new offer
const addOffer = async (req, res) => {
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
      categorySelection = [],
    } = req.body;

    // Basic validations
    if (
      !offerName ||
      !offerType ||
      !discountType ||
      !discountValue ||
      !startDate ||
      !endDate ||
      !offerStatus ||
      !offerDescription
    ) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'All fields are required.' });
    }
    if (!/^[A-Z0-9]+$/.test(offerName)) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Only capital letters and numbers are allowed for Offer Name.',
      });
    }
    if (discountValue <= 0 || discountValue >= 60) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Discount Value must be between 1 and 59.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end)
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'End date must be after start date.' });

    const existingOffers = await Offer.find({ offerName });
    if (existingOffers.length > 0) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'An offer with this name already exists.' });
    }

    const categoryIds = Array.isArray(categorySelection)
      ? categorySelection
      : categorySelection
        ? [categorySelection]
        : [];
    const productIds = Array.isArray(productSelection)
      ? productSelection
      : productSelection
        ? [productSelection]
        : [];

    if (offerType === 'category' && categoryIds.length === 0) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Please select at least one category' });
    }
    if (offerType === 'product' && productIds.length === 0) {
      return res
        .status(httpStatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Please select at least one product' });
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
      ...(offerType === 'category' ? { categoryIds } : { productIds }),
    });

    await offer.save();

    // Fetch affected products and apply best offer
    let affectedProducts = [];
    if (offerType === 'category') {
      affectedProducts = await Product.find({ category: { $in: categoryIds } });
    } else if (offerType === 'product') {
      affectedProducts = await Product.find({ _id: { $in: productIds } });
    }
    await applyOffersToProductsAndUpdateCarts(affectedProducts);

    res
      .status(httpStatusCodes.CREATED)
      .json({ success: true, message: 'Offer created successfully' });
  } catch (error) {
    console.error('Add offer error:', error);
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

// Edit an existing offer
const editOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
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
      productSelection = [],
    } = req.body;

    const offer = await Offer.findById(offerId);
    if (!offer)
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Offer not found' });

    // Update offer fields
    offer.offerName = offerName;
    offer.offerType = offerType;
    offer.discountType = discountType;
    offer.discountValue = discountValue;
    offer.startDate = new Date(startDate);
    offer.endDate = new Date(endDate);
    offer.offerStatus = offerStatus;
    offer.offerDescription = offerDescription;

    if (offerType === 'category') {
      offer.categoryIds = categorySelection;
      offer.productIds = [];
    } else {
      offer.productIds = productSelection;
      offer.categoryIds = [];
    }

    await offer.save();

    // Fetch affected products and apply best offer
    let affectedProducts = [];
    if (offerType === 'category') {
      affectedProducts = await Product.find({ category: { $in: categorySelection } });
    } else {
      affectedProducts = await Product.find({ _id: { $in: productSelection } });
    }
    await applyOffersToProductsAndUpdateCarts(affectedProducts);

    res.status(httpStatusCodes.OK).redirect('/admin/offers');
  } catch (error) {
    console.error('Edit offer error:', error);
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};
const getOffers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5; // Set to 5 for consistency
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = search ? { offerName: { $regex: search, $options: 'i' } } : {};

    const [totalOffers, offers] = await Promise.all([
      Offer.countDocuments(query),
      Offer.find(query).populate('categoryIds').skip(skip).limit(limit).sort({ startDate: -1 }),
    ]);

    const totalPages = Math.ceil(totalOffers / limit);
    const products = await Product.find();

    res.render('adminoffer/offer', {
      offers,
      products,
      currentPath: '/offer',
      layout: 'layouts/adminLayout',
      currentPage: page,
      totalPages,
      limit,
      search,
    });
  } catch (error) {
    console.error('Error in getOffers:', error);
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

const getOffersData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5; // Set to 5 for consistency
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = search ? { offerName: { $regex: search, $options: 'i' } } : {};

    const [totalOffers, offers] = await Promise.all([
      Offer.countDocuments(query),
      Offer.find(query).populate('categoryIds').skip(skip).limit(limit).sort({ startDate: -1 }),
    ]);

    const totalPages = Math.ceil(totalOffers / limit);
    const products = await Product.find();

    res.json({
      offers: offers.map((o) => o.toObject()),
      products: products.map((p) => p.toObject()),
      currentPage: page,
      totalPages,
      limit,
      search,
    });
  } catch (error) {
    console.error('Error in getOffersData:', error);
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

const deleteOffer = async (req, res) => {
  try {
    const offerId = req.params.offerId;
    const offer = await Offer.findById(offerId);
    if (!offer)
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Offer not found' });

    const affectedProducts = await Product.find({ offers: offerId });

    await Product.updateMany({ offers: offerId }, { $pull: { offers: offerId } });

    await Offer.findByIdAndDelete(offerId);

    await applyOffersToProductsAndUpdateCarts(affectedProducts);

    res.status(httpStatusCodes.OK).json({ success: true, message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('Delete offer error:', error);
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: 'An error occurred while deleting the offer.' });
  }
};
const getAddOffer = async (req, res) => {
  try {
    const categories = await Category.find({});
    const products = await Product.find({}); // Fetch all products as well
    res.render('adminoffer/addoffer', {
      categories,
      products,
      currentPath: '/offer',
      layout: 'layouts/adminLayout',
    }); // Pass products to the template
  } catch (error) {
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

const getEditOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const offer = await Offer.findById(offerId); // Fetch the specific offer
    console.log('Fetched offer:', offer);

    if (!offer) {
      // return res.status(404).render('errorPage', { message: 'Offer not found' }); // Render an error page
      return res
        .status(httpStatusCodes.NOT_FOUND)
        .json({ success: false, message: 'offer not found' });
    }

    // Fetch all products and categories to populate the select options
    const categories = await Category.find();
    const products = await Product.find();
    console.log('Categories:', categories);
    console.log('Products:', products);

    res.render('adminoffer/editoffer', {
      offer,
      categories, // Pass categories to the template
      products, // Pass products to the template
      currentPath: '/offer',
      layout: 'layouts/adminLayout',
    });
  } catch (error) {
    console.error('Error fetching offer for editing:', error.message);
    res
      .status(httpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

module.exports = {
  getOffers,
  getOffersData,
  getAddOffer,
  addOffer,
  getEditOffer,
  editOffer,
  deleteOffer,
};
