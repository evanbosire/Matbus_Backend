const mongoose = require('mongoose');

const communityServiceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  volunteers: [{
    youth: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'completed'],
      default: 'pending'
    },
    instructions: String,
    completedDate: Date
  }],
  coordinator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'completed'],
    default: 'open'
  },
  completionDate: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CommunityService', communityServiceSchema);