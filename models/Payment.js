const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  mpesaCode: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^[A-Z0-9]{10}$/.test(v) && v !== '0000000000';
      },
      message: 'MPESA code must be exactly 10 characters (uppercase letters and numbers only), and cannot be all zeros'
    },
    set: v => v.toUpperCase() 
  },
  amount: {
    type: Number,
    required: true
  },
  course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
  payer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  type: {
    type: String,
    enum: ['course_payment', 'supplier_payment', 'donation'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  verificationDate: Date,
  relatedEnrollment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enrollment'
  },
  relatedSupply: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupplyRequest'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
