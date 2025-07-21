const express = require('express');
const router = express.Router();
const { jwtAuth, userProtected } = require('../middlewares/auth');
const addressController = require('../controllers/addressController');

router.use(jwtAuth, userProtected);
router.get('/', addressController.getAddress);
router.get('/add-address', addressController.getAddAddress);
router.post('/add-address', addressController.postAddAddress);
router.get('/edit-address/:id', addressController.getEditAddress);
router.patch('/edit-address/:id', addressController.patchEditAddress);
router.delete('/delete-address/:id', addressController.deleteAddress);

module.exports = router;
