const mongoose = require("mongoose");

const DutySchema = new mongoose.Schema({
  dutyName: { type: String, required: true },
  description: String,
  location: { type: String, required: true },
  date: { type: Date, required: true },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee", // duties_manager
    required: true,
  },

  coordinator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee", // community_service_coordinator
  },

  // youths who have voluntarily enrolled
  enrolledYouths: [
    {
      youth: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
      status: {
        type: String,
        enum: ["enrolled", "present", "absent"],
        default: "enrolled",
      },
    },
  ],

  capacity: { type: Number, default: 10 }, // optional: max youths allowed

  report: {
    summary: String,
    photos: [String],
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    submittedAt: Date,
  },

  status: {
    type: String,
    enum: ["open", "in_progress", "completed", "approved"],
    default: "open",
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Duty", DutySchema);
