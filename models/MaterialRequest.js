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
    }, 
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" }, 
    quantityRequested: { type: Number, required: true, min: 1 },
    quantityIssued: { type: Number, default: 0 }, 
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

   
    requestedAt: { type: Date, default: Date.now },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" }, 
    returnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" }, 
    returnedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("MaterialRequest", materialRequestSchema);
