const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  serviceTitle: String,
  customerId: String,
  customerName: String,       // ✅ Added
  customerEmail: String,      // ✅ Added
  customerPhone: String,      // ✅ Added
  hours: { type: Number, default: 1, min: 1 },
  totalPrice: Number,
  paymentCode: String,
  paymentApproved: { type: Boolean, default: false },
  receiptUrl: String, // Added for receipt download
  assignedSupervisor: { type: Boolean, default: false }, // Changed to Boolean
  assignedCoach: { type: Boolean, default: false }, 
  serviceRendered: { type: Boolean, default: false },
  supervisorConfirmed: { type: Boolean, default: false },
  managerApproved: { type: Boolean, default: false },
  serviceManagerReply: String,
  feedback: String
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
