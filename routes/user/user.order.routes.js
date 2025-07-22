const express = require('express');
const router = express.Router();
const { jwtAuth, userProtected } = require('../../middlewares/auth');
const orderController = require('../../controllers/user/user.order.controller');
router.use(jwtAuth, userProtected);

router.get('/', orderController.getOrders);
router.get('/:orderId', orderController.getOrderDetailed);
router.post('/:orderId/cancel', orderController.postOrderCancel);
router.get('/return/:orderId', orderController.getReturnOrderId);
router.post('/return/:orderId', orderController.postReturnOrderId);
router.get('/download-invoice/:orderId', orderController.getInvoiceDowload);
router.post(
  '/cancelsingle/:orderId/:productId/:productSize/:productQuantity',
  orderController.postCancelSingleProduct
);
module.exports = router;
