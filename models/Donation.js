const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  donor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee', 
    required: true
  },
  mpesaCode: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
       
        return /^[A-Z0-9]{10}$/.test(v) && v !== '0000000000';
      },
      message: 'MPESA code must be 10 characters of uppercase letters and numbers only, and cannot be all zeros'
    }
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee' 
  },
  approvalDate: Date,
  receiptUrl: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Donation', donationSchema);
