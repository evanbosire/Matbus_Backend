
const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    duration: {
      value: { type: Number, required: true },
      unit: {
        type: String,
        enum: ["weeks", "months"],
        required: true,
      },
    },
    fees: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date }, // auto-calculated
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed"],
      default: "upcoming",
    },
    maxParticipants: Number,
    currentParticipants: {
      type: Number,
      default: 0,
    },
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
  },
  
  { timestamps: true }
);

module.exports = mongoose.model("Course", courseSchema);
