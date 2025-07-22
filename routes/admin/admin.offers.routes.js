const express = require('express');
const methodOverride = require('method-override');
const { jwtAuth, adminProtected } = require('../../middlewares/auth');
const adminOfferController = require('../../controllers/admin/admin.offers.controller');
const router = express.Router();
router.use(express.urlencoded({ extended: true })); // To parse form data
router.use(methodOverride('_method'));

router.use(jwtAuth, adminProtected);

router.get('/', adminOfferController.getOffers);
router.get('/add-offer', adminOfferController.getAddOffer);
router.post('/add-offer', adminOfferController.addOffer);
router.get('/edit-offer/:id', adminOfferController.getEditOffer);
router.post('/edit-offer/:id', adminOfferController.editOffer);
router.delete('/delete-offer/:offerId', adminOfferController.deleteOffer);

module.exports = router;
