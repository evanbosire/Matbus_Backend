const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  youth: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  enrollment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enrollment',
    required: true
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  certificateUrl: String,
  verificationCode: {
    type: String,
    unique: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Certificate', certificateSchema);