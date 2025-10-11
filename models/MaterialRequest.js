const mongoose = require("mongoose");

const materialRequestSchema = new mongoose.Schema(
  {
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainingMaterial",
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    }, // trainer
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" }, // optional: course using the materials
    quantityRequested: { type: Number, required: true, min: 1 },
    quantityIssued: { type: Number, default: 0 }, // what inventory manager actually released
    status: {
      type: String,
      enum: [
        "pending",
        "rejected",
        "released",
        "partially_returned",
        "returned",
      ],
      default: "pending",
    },
    note: String,

    // audit
    requestedAt: { type: Date, default: Date.now },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" }, // inventory manager who released/rejected
    processedAt: Date,
    returnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" }, // trainer who returns (can be same requestedBy)
    returnedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("MaterialRequest", materialRequestSchema);
