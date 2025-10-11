const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
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
  enrollmentDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'payment_verified', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  mentor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  attendance: [{
    date: Date,
    present: Boolean
  }],
  completionDate: Date,
  feedback: {
    text: String,
    rating: Number,
    date: Date,
    replies: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'feedback.replies.userModel'
      },
      userModel: {
        type: String,
        enum: ['Customer', 'Employee']
      },
      text: String,
      date: Date
    }]
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Enrollment', enrollmentSchema);