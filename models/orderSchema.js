const mongoose = require('mongoose');
const { Schema } = mongoose;
const User = require('./userSchema');

const orderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    products: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        quantity: Number,
        price: Number,
        size: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: ['active', 'cancelled', 'returned'],
          default: 'active',
        },
      },
    ],
    totalPrice: {
      type: Number,
      required: true,
    },
    shippingAddress: {
      phoneNo: {
        type: Number,
        required: true,
      },
      street: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      postalCode: {
        type: Number,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    deliveryDate: { type: Date },
    status: {
      type: String,
      enum: [
        'pending',
        'processing',
        'shipped',
        'delivered',
        'pending_return',
        'processing_return',
        'initiated_return',
        'rejected_return',
        'returned',
        'refunded',
        'cancelled',
        'payment_failed',
        'out_of_stock',
        'on_hold',
        'failed',
      ],
      default: 'pending',
    },
    returnReason: {
      type: String,
    },
    paymentDetails: {
      paymentMethod: {
        type: String,
        required: true,
      },
      transactionId: {
        type: String,
        required: true,
      },
    },
    orderedProducts: [
      {
        productName: {
          type: String,
          required: true,
        },
        productPrice: {
          type: Number,
          required: true,
        },
        productQuantity: {
          type: Number,
          required: true,
        },
        productSize: {
          type: Number,
          required: true,
        },
        productImage: {
          type: String,
          required: true,
        },
        productId: {
          type: String,
          required: true,
        },
        offerDiscountPerUnit: {
          type: Number,
          default: 0,
        },
        finalUnitPrice: {
          type: Number,
          required: true,
        },
        status: {
          type: String,
          enum: ['active', 'cancelled', 'returned'],
          default: 'active',
        },
      },
    ],
    isDiscount: {
      type: Boolean,
      default: false,
    },
    discount: {
      type: Number,
    },
    originalPrice: {
      type: Number,
    },
    genOrderId: {
      type: String,
      default: 'generatedOrderId',
    },
    couponDiscount: {
      type: Number,
      default: 0,
    },
    couponId: {
      type: Schema.Types.ObjectId,
      ref: 'coupon',
      default: null,
    },
    offerTotalDiscount: {
      type: Number,
      default: 0,
    },
    subtotalAfterOffers: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model('order', orderSchema);
module.exports = Order;
