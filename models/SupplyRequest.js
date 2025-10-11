const mongoose = require("mongoose");

const supplyRequestSchema = new mongoose.Schema(
  {
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainingMaterial",
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    neededBy: Date,
    note: String,

    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    pricePerUnit: Number,
    totalPrice: Number,

    status: {
      type: String,
      enum: [
        "pending",
        "rejected_by_supplier",
        "accepted_by_supplier",
        "delivered",
        "inventory_rejected",
        "inventory_accepted",
        "paid",
      ],
      default: "pending",
    },

    deliveryDate: Date,
    deliveryNote: String,
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    acceptanceDate: Date,
    supplyPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplyPayment",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupplyRequest", supplyRequestSchema);
