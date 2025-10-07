const mongoose = require('mongoose');
const { Schema } = mongoose;

const categorySchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: [3, 'Minimum 3 characters required'],
    maxlength: [20, 'Maximum 20 characters allowed'],
  },
  description: String,
  isBlocked: {
    type: Boolean,
    default: false,
  },
  orderCount: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model('Category', categorySchema);
